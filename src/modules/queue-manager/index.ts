/**
 * queue-manager: serializes/retries AI provider calls and long-running background jobs.
 * Keeps the UI responsive and avoids hammering AI providers with concurrent requests.
 */

interface QueueTask<T> {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  retriesLeft: number;
}

const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

class Queue {
  private tasks: QueueTask<unknown>[] = [];
  private running = false;

  enqueue<T>(run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.tasks.push({
        run: run as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
        retriesLeft: MAX_RETRIES,
      });
      void this.drain();
    });
  }

  private async drain() {
    if (this.running) return;
    this.running = true;
    while (this.tasks.length > 0) {
      const task = this.tasks.shift()!;
      await this.execute(task);
    }
    this.running = false;
  }

  private async execute(task: QueueTask<unknown>) {
    try {
      const result = await task.run();
      task.resolve(result);
    } catch (error) {
      if (task.retriesLeft > 0) {
        const attempt = MAX_RETRIES - task.retriesLeft;
        await new Promise((r) => setTimeout(r, RETRY_BASE_DELAY_MS * 2 ** attempt));
        task.retriesLeft -= 1;
        this.tasks.unshift(task);
      } else {
        task.reject(error);
      }
    }
  }
}

export const aiQueue = new Queue();
