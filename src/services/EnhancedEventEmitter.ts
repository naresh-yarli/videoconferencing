// src/services/EnhancedEventEmitter.ts

type Listener = (...args: any[]) => void;

export class EnhancedEventEmitter {
  private events: Map<string, Set<Listener>>;

  constructor() {
    this.events = new Map();
  }

  public on(event: string, listener: Listener): this {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(listener);
    return this;
  }

  public off(event: string, listener: Listener): this {
    if (this.events.has(event)) {
      this.events.get(event)!.delete(listener);
      if (this.events.get(event)!.size === 0) {
        this.events.delete(event);
      }
    }
    return this;
  }

  public emit(event: string, ...args: any[]): boolean {
    if (this.events.has(event)) {
      this.events.get(event)!.forEach((listener) => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
      return true;
    }
    return false;
  }

  public removeAllListeners(event?: string): this {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    return this;
  }

  public listenerCount(event: string): number {
    return this.events.has(event) ? this.events.get(event)!.size : 0;
  }

  public listeners(event: string): Listener[] {
    return this.events.has(event) ? Array.from(this.events.get(event)!) : [];
  }

  public once(event: string, listener: Listener): this {
    const onceWrapper = (...args: any[]) => {
      this.off(event, onceWrapper);
      listener(...args);
    };
    return this.on(event, onceWrapper);
  }
}
