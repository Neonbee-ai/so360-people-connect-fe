/**
 * Test double for @so360/event-bus.
 *
 * Must mirror the REAL singleton's surface (subscribe/publish/clear), not just
 * the legacy emit/on/off helpers. A method missing here fails as
 * "publish does not exist" the moment a spec does vi.spyOn(eventBus, …) —
 * which reads like a product bug but is a stub gap. Same trap as the ambient
 * d.ts in src/types.
 */
const listeners: Record<string, Array<(payload: unknown) => void>> = {};

export const eventBus = {
  subscribe(topic: string, cb: (payload: never) => void) {
    (listeners[topic] ||= []).push(cb as (payload: unknown) => void);
    return () => {
      listeners[topic] = (listeners[topic] || []).filter(fn => fn !== cb);
    };
  },
  publish(topic: string, payload?: unknown) {
    (listeners[topic] || []).forEach(cb => cb(payload));
  },
  clear() {
    Object.keys(listeners).forEach(k => delete listeners[k]);
  },
  // Legacy helpers kept so existing specs importing them keep working.
  emit: () => {},
  on: () => () => {},
  off: () => {},
};

export const useEventBus = () => eventBus;
