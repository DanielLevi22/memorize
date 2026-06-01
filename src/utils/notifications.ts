/**
 * notifications.ts
 * Utilitário para permissão, agendamento e disparo de notificações Web Push locais.
 * Funciona sem servidor — usa a Notifications API do navegador + verificação diária.
 */

const NOTIF_LAST_KEY = 'memorize_last_notification_date';
const NOTIF_ENABLED_KEY = 'memorize_notifications_enabled';

/** Solicita permissão de notificação ao usuário */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return await Notification.requestPermission();
}

/** Retorna o status atual da permissão */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/** Dispara uma notificação visual com título e corpo */
function fireNotification(title: string, body: string, dueCount: number) {
  if (Notification.permission !== 'granted') return;

  const notif = new Notification(title, {
    body,
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    tag: 'memorize-daily',   // evita notificações duplicadas
  } as any);

  notif.onclick = () => {
    window.focus();
    notif.close();
  };

  // Atualiza badge do ícone do PWA (se suportado)
  if ('setAppBadge' in navigator) {
    (navigator as any).setAppBadge(dueCount).catch(() => {});
  }
}

/** Limpa o badge do ícone do PWA */
export function clearAppBadge() {
  if ('clearAppBadge' in navigator) {
    (navigator as any).clearAppBadge().catch(() => {});
  }
}

/**
 * Verifica cards vencidos e dispara notificação se necessário.
 * Só dispara uma vez por dia.
 */
export async function checkAndNotify(dueCount: number): Promise<void> {
  const enabled = localStorage.getItem(NOTIF_ENABLED_KEY) !== 'false';
  if (!enabled) return;
  if (Notification.permission !== 'granted') return;
  if (dueCount === 0) {
    clearAppBadge();
    return;
  }

  // Atualiza badge mesmo sem notificação
  if ('setAppBadge' in navigator) {
    (navigator as any).setAppBadge(dueCount).catch(() => {});
  }

  // Verifica se já notificou hoje
  const today = new Date().toISOString().split('T')[0];
  const lastDate = localStorage.getItem(NOTIF_LAST_KEY);
  if (lastDate === today) return;

  localStorage.setItem(NOTIF_LAST_KEY, today);

  fireNotification(
    '📚 Hora de revisar!',
    dueCount === 1
      ? 'Você tem 1 cartão para revisar hoje. Bora lá!'
      : `Você tem ${dueCount} cartões para revisar hoje. Mantenha seu ritmo! 🔥`,
    dueCount
  );
}

/** Configura notificações no boot do app (chame no useEffect de App.tsx) */
export async function setupNotifications(dueCount: number): Promise<void> {
  if (!('Notification' in window)) return;

  // Se já tem permissão, só verifica cards
  if (Notification.permission === 'granted') {
    await checkAndNotify(dueCount);
  }
}

/** Dispara uma notificação local direta (usada para alertas da jornada CEFR) */
export function triggerLocalNotification(title: string, body: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  new Notification(title, {
    body,
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    tag: 'cefr-alert'
  });
}

