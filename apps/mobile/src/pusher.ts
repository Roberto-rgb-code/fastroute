import Pusher from 'pusher-js';
import { api, Message } from './api';

let shared: Pusher | null = null;
let sharedKey: string | null = null;

async function getPusher(): Promise<Pusher | null> {
  const cfg = await api.clientConfig();
  const key = cfg.pusher?.key?.trim();
  if (!key) return null;
  const cluster = cfg.pusher.cluster || 'us2';
  if (shared && sharedKey === key) return shared;
  shared?.disconnect();
  shared = new Pusher(key, { cluster });
  sharedKey = key;
  return shared;
}

/** Suscripción al canal de chat de una ruta. Devuelve función de cleanup. */
export async function subscribeRouteMessages(
  routeId: string,
  onMessage: (msg: Message) => void,
): Promise<() => void> {
  const pusher = await getPusher();
  if (!pusher) return () => undefined;

  const channelName = `route-${routeId}`;
  const channel = pusher.subscribe(channelName);
  const handler = (msg: Message) => {
    if (msg.routeId === routeId) onMessage(msg);
  };
  channel.bind('message', handler);

  return () => {
    channel.unbind('message', handler);
    pusher.unsubscribe(channelName);
  };
}

export function disconnectPusher() {
  shared?.disconnect();
  shared = null;
  sharedKey = null;
}
