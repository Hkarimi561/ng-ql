import { Injectable, signal } from '@angular/core';

/**
 * Controls the mock backend's simulated network behavior. Adjustable live
 * from the showcase UI so visitors can see loading/error states without a
 * real API.
 */
@Injectable({ providedIn: 'root' })
export class MockApiService {
  readonly latencyMs = signal(400);
  readonly errorRate = signal(0);
  readonly enabled = signal(true);

  shouldFail(): boolean {
    return this.enabled() && Math.random() * 100 < this.errorRate();
  }

  delay(): number {
    return this.enabled() ? this.latencyMs() : 0;
  }
}
