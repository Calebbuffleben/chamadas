// Content script
// - Faz a ponte das mensagens do background -> página via window.postMessage (MAIN world)
// - Scripts (audio-capture.js, feedback-overlay.js, socket.io) são injetados pelo background via executeScript (MAIN world)

(function () {
	let currentTabId = null;
	
	let wsPort = null;
	let portConnectionAttempts = 0;
	let portCreationPending = false;
	
	function ensurePort() {
		try {
			if (!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id)) {
				console.error('[content] chrome.runtime not available', {
					hasChrome: typeof chrome !== 'undefined',
					hasRuntime: !!(chrome && chrome.runtime),
					runtimeId: chrome?.runtime?.id
				});
				return null;
			}
			if (wsPort) {
				return wsPort;
			}
			if (portCreationPending) {
				return null;
			}
			portCreationPending = true;
			portConnectionAttempts++;
			console.log('[content] Creating new port connection', { attempt: portConnectionAttempts });
			
			// Try to wake up service worker by sending a dummy message first
			try {
				chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
					void chrome.runtime.lastError; // Clear lastError
				});
			} catch (pingErr) {
				// ignore
			}
			
			wsPort = chrome.runtime.connect({ name: 'audio-ws' });
			wsPort.onDisconnect.addListener(() => {
				const err = chrome.runtime.lastError;
				console.warn('[content] Port disconnected', { error: err?.message });
				wsPort = null;
				portCreationPending = false;
			});
			
			// Test the port connection
			try {
				wsPort.postMessage({ type: 'PING' });
			} catch (testErr) {
				console.error('[content] Port test failed:', testErr);
			}
			
			portCreationPending = false;
			console.log('[content] Port connected successfully');
			return wsPort;
		} catch (e) {
			console.error('[content] Failed to create port:', e);
			wsPort = null;
			portCreationPending = false;
			return null;
		}
	}

	function registerRuntimeListener() {
		try {
			if (!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id)) {
				return;
			}
			const handler = (message, _sender, sendResponse) => {
				if (message?.type === 'INJECT_AND_START') {
					// Scripts já foram injetados pelo background via chrome.scripting.executeScript
					const payload = message.payload || {};
					if (typeof payload.tabId === 'number') {
						currentTabId = payload.tabId;
					}
					
					// Iniciar captura de áudio
					if (payload.streamId) {
						window.postMessage({ type: 'AUDIO_CAPTURE_START', payload }, '*');
					}
					
					// Iniciar overlay
					const overlayPayload = {
						meetingId: payload.meetingId,
						feedbackHttpBase: payload.feedbackHttpBase
					};
					window.postMessage({ type: 'FEEDBACK_OVERLAY_START', payload: overlayPayload }, '*');
					
					sendResponse?.({ ok: true });
					return true;
				}

				if (message?.type === 'STOP_CAPTURE') {
					window.postMessage({ type: 'AUDIO_CAPTURE_STOP' }, '*');
					sendResponse?.({ ok: true });
					return true;
				}

				if (message?.type === 'CAPTURE_FAILED') {
					console.warn('[content] Falha ao capturar áudio da aba:', message.error);
					sendResponse?.({ ok: true });
					return true;
				}
				return undefined;
			};
			chrome.runtime.onMessage.addListener(handler);
			try {
				if (chrome.runtime && typeof chrome.runtime.getManifest === 'function') {
					const manifest = chrome.runtime.getManifest();
					if (manifest && manifest.manifest_version === 3 && chrome.runtime.onSuspend) {
						chrome.runtime.onSuspend.addListener(() => {
							try {
								chrome.runtime.onMessage.removeListener(handler);
							} catch (_e) {}
						});
					}
				}
			} catch (_e) {}
		} catch (_e) {}
	}

	registerRuntimeListener();

	// Verify extension is loaded
	console.log('[content] Content script loaded');

	// Bridge page->background for audio WS
	window.addEventListener('message', (event) => {
		if (event.source !== window) return;
		const data = event.data || {};
		
		if (data.type === 'AUDIO_WS_OPEN') {
			const url = data.url;
			const tabId = data.tabId ?? currentTabId;
			if (!url) return;
			const port = ensurePort();
			if (!port) return;
			try {
				port.postMessage({ type: 'AUDIO_WS_OPEN', tabId, url });
			} catch (e) {
				console.error('[content] Failed to send AUDIO_WS_OPEN:', e);
			}
			return;
		}
		if (data.type === 'AUDIO_WS_SEND') {
			const buf = data.buffer;
			const tabId = data.tabId ?? currentTabId;
			if (!buf) return;
			const port = ensurePort();
			if (!port) return;
			
			try {
				let arrayBuffer = null;
				let byteLength = 0;
				if (buf instanceof ArrayBuffer) {
					arrayBuffer = buf.slice(0);
					byteLength = arrayBuffer.byteLength;
				} else if (ArrayBuffer.isView(buf)) {
					const view = buf;
					arrayBuffer = view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
					byteLength = view.byteLength;
				} else {
					return;
				}
				
				try {
					// Convert to Uint8Array for better serialization support in port.postMessage
					const uint8Array = new Uint8Array(arrayBuffer);
					const message = { type: 'AUDIO_WS_SEND', tabId, buffer: uint8Array, byteLength };
					port.postMessage(message);
				} catch (postErr) {
					console.error('[content] postMessage failed:', postErr);
					wsPort = null; // Force reconnect on next send
				}
			} catch (e) {
				console.error('[content] Error sending to background:', e);
			}
			return;
		}
		if (data.type === 'AUDIO_WS_CLOSE') {
			const tabId = data.tabId ?? currentTabId;
			const port = ensurePort();
			if (!port) return;
			try {
				port.postMessage({ type: 'AUDIO_WS_CLOSE', tabId });
			} catch (_e) {}
			return;
		}
	}, false);
})();
