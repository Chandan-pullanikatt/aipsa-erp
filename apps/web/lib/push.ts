// Native push registration. The web app runs inside the Capacitor Android shell,
// which injects the Capacitor bridge on `window.Capacitor`. We talk to the native
// @capacitor/push-notifications plugin through that bridge — so the web bundle needs
// no Capacitor dependency. On a normal browser (no native bridge) this is a no-op.
import api from './api';

type PushPlugin = {
  checkPermissions: () => Promise<{ receive: string }>;
  requestPermissions: () => Promise<{ receive: string }>;
  register: () => Promise<void>;
  addListener: (event: string, cb: (data: { value?: string }) => void) => void;
};

type CapacitorWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    Plugins?: { PushNotifications?: PushPlugin };
  };
};

let registered = false;

export async function registerPushNotifications(): Promise<void> {
  if (typeof window === 'undefined' || registered) return;
  const cap = (window as CapacitorWindow).Capacitor;
  if (!cap?.isNativePlatform?.()) return; // only inside the native app
  const Push = cap.Plugins?.PushNotifications;
  if (!Push) return;
  registered = true;

  try {
    let perm = await Push.checkPermissions();
    if (perm.receive === 'prompt') perm = await Push.requestPermissions();
    if (perm.receive !== 'granted') return;

    Push.addListener('registration', (token) => {
      if (!token.value) return;
      api.post('/communication/device-token', { token: token.value, platform: 'android' }).catch(() => {});
    });
    Push.addListener('registrationError', () => {});

    await Push.register();
  } catch {
    registered = false; // allow a later retry
  }
}
