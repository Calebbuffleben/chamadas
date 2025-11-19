// Content script
// - Injeta audio-capture.js no contexto da página (MAIN world)
// - Faz a ponte das mensagens do background -> página via window.postMessage

(function () {
	let overlayInjected = false;
	let overlayLoaded = false;
	const pendingOverlayStarts = [];
	let audioInjected = false;
	let audioLoaded = false;
	const pendingAudioStarts = [];
	let currentTabId = null;

	function safeGetURL(path) {
		try {
			if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
				return chrome.runtime.getURL(path);
			}
		} catch (_e) {}
		return null;
	}

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
				console.log('[content] Reusing existing port');
				return wsPort;
			}
			if (portCreationPending) {
				console.warn('[content] Port creation already pending');
				return null;
			}
			portCreationPending = true;
			portConnectionAttempts++;
			console.log('[content] Creating new port connection', { attempt: portConnectionAttempts, runtimeId: chrome.runtime.id });
			
			// Try to wake up service worker by sending a dummy message first
			try {
				chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
					void chrome.runtime.lastError; // Clear lastError
					console.log('[content] Service worker ping response:', response);
				});
			} catch (pingErr) {
				console.warn('[content] Ping failed:', pingErr);
			}
			
			wsPort = chrome.runtime.connect({ name: 'audio-ws' });
			wsPort.onDisconnect.addListener(() => {
				const err = chrome.runtime.lastError;
				console.error('[content] Port disconnected!', { 
					error: err?.message,
					errorString: err ? JSON.stringify(err) : 'no error',
					attempt: portConnectionAttempts,
					runtimeId: chrome?.runtime?.id
				});
				wsPort = null;
				portCreationPending = false;
			});
			
			// Test the port connection immediately
			try {
				wsPort.postMessage({ type: 'PING' });
				console.log('[content] Port test message sent');
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

	function injectFeedbackOverlay() {
		if (overlayInjected) return;
		overlayInjected = true;
		const url = safeGetURL('feedback-overlay.js');
		if (!url) return;
		const script = document.createElement('script');
		script.src = url;
		script.async = false;
		script.onload = () => {
			overlayLoaded = true;
			while (pendingOverlayStarts.length) {
				const payload = pendingOverlayStarts.shift();
				window.postMessage({ type: 'FEEDBACK_OVERLAY_START', payload }, '*');
			}
		};
		(document.head || document.documentElement).appendChild(script);
	}

	function injectAudioCapture() {
		if (audioInjected) return;
		audioInjected = true;
		const url = safeGetURL('audio-capture.js');
		if (!url) return;
		const script = document.createElement('script');
		script.src = url;
		script.async = false;
		script.onload = () => {
			audioLoaded = true;
			while (pendingAudioStarts.length) {
				const payload = pendingAudioStarts.shift();
				window.postMessage({ type: 'AUDIO_CAPTURE_START', payload }, '*');
			}
		};
		(document.head || document.documentElement).appendChild(script);
	}

	function registerRuntimeListener() {
		try {
			if (!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id)) {
				return;
			}
			const handler = (message, _sender, sendResponse) => {
				if (message?.type === 'INJECT_AND_START') {
					injectFeedbackOverlay();
					// audio capture (content mode)
					if (message.payload && message.payload.streamId) {
						injectAudioCapture();
					}
					const payload = message.payload || {};
					if (typeof payload.tabId === 'number') {
						currentTabId = payload.tabId;
					}
					if (payload.streamId) {
						if (audioLoaded) {
							window.postMessage({ type: 'AUDIO_CAPTURE_START', payload }, '*');
						} else {
							pendingAudioStarts.push(payload);
						}
					}
					const overlayPayload = {
						meetingId: payload.meetingId,
						feedbackHttpBase: payload.feedbackHttpBase
					};
					if (overlayLoaded) {
						window.postMessage({ type: 'FEEDBACK_OVERLAY_START', payload: overlayPayload }, '*');
					} else {
						pendingOverlayStarts.push(overlayPayload);
					}
					sendResponse?.({ ok: true });
					return true;
				}

				if (message?.type === 'STOP_CAPTURE') {
					// stop audio (content mode)
					if (audioLoaded) {
						window.postMessage({ type: 'AUDIO_CAPTURE_STOP' }, '*');
					}
					sendResponse?.({ ok: true });
					return true;
				}

				if (message?.type === 'CAPTURE_FAILED') {
					// Feedback básico ao usuário no console da página
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
	console.log('[content] Content script loaded', { 
		hasRuntime: !!(typeof chrome !== 'undefined' && chrome.runtime),
		runtimeId: chrome?.runtime?.id,
		url: window.location.href
	});

	// Bridge page->background for audio WS
	window.addEventListener('message', (event) => {
		if (event.source !== window) return;
		const data = event.data || {};
		console.log('[content] window.message received', { type: data.type, tabId: data.tabId, currentTabId });
		if (data.type === 'AUDIO_WS_OPEN') {
			const url = data.url;
			const tabId = data.tabId ?? currentTabId;
			if (!url) {
				console.warn('[content] AUDIO_WS_OPEN: no URL provided');
				return;
			}
			const port = ensurePort();
			if (!port) {
				console.error('[content] AUDIO_WS_OPEN: Failed to create port');
				return;
			}
			try {
				console.log('[content] Sending AUDIO_WS_OPEN to background', { tabId, url });
				port.postMessage({ type: 'AUDIO_WS_OPEN', tabId, url });
			} catch (e) {
				console.error('[content] Failed to send AUDIO_WS_OPEN:', e);
			}
			return;
		}
		if (data.type === 'AUDIO_WS_SEND') {
			const buf = data.buffer;
			const tabId = data.tabId ?? currentTabId;
			console.log('[content] AUDIO_WS_SEND received', { 
				tabId,
				hasBuf: !!buf, 
				isArrayBuffer: buf instanceof ArrayBuffer, 
				isView: ArrayBuffer.isView(buf),
				constructor: buf?.constructor?.name,
				byteLength: buf?.byteLength
			});
			if (!buf) return;
			const port = ensurePort();
			if (!port) {
				console.warn('[content] No port available');
				return;
			}
			// Verify port is still connected
			try {
				if (port.sender) {
					console.log('[content] Port sender info:', { id: port.sender.id, url: port.sender.url });
				}
			} catch (err) {
				console.warn('[content] Port may be disconnected:', err);
			}
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
					console.warn('[content] Buffer is not ArrayBuffer or View, dropping chunk');
					return;
				}
				console.log('[content] Preparing to send', { 
					tabId, 
					byteLength,
					isArrayBuffer: arrayBuffer instanceof ArrayBuffer,
					bufferConstructor: arrayBuffer?.constructor?.name
				});
				try {
					// Convert to Uint8Array for better serialization support in port.postMessage
					const uint8Array = new Uint8Array(arrayBuffer);
					const message = { type: 'AUDIO_WS_SEND', tabId, buffer: uint8Array, byteLength };
					console.log('[content] Message prepared', {
						hasBuffer: !!message.buffer,
						bufferType: message.buffer?.constructor?.name,
						isUint8: message.buffer instanceof Uint8Array
					});
					port.postMessage(message);
					console.log('[content] postMessage sent successfully');
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
				console.log('[content] Sending AUDIO_WS_CLOSE to background', { tabId });
				port.postMessage({ type: 'AUDIO_WS_CLOSE', tabId });
			} catch (_e) {}
			return;
		}
	}, false);
})();


