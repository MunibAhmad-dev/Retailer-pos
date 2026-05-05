export interface SubscriptionState {
  isActive: boolean;
  isGracePeriod: boolean;
  isExpired: boolean;
  daysRemaining: number;
  plan: 'monthly' | 'yearly' | 'lifetime' | 'none';
  expiryDate: string | null;
}

class SubscriptionService {
  private state: SubscriptionState | null = null;
  private readonly GRACE_PERIOD_DAYS = 0; // Strictly enforced

  public async initialize(): Promise<SubscriptionState> {
    try {
      const res = await (window as any).api.isActivated();
      
      if (!res.success || !res.activated) {
        return this.setDefaultState();
      }

      // Legacy MD5 license logic (No expiry date) -> Lifetime
      if (!res.license || res.license.isLegacy) {
        this.state = {
          isActive: true,
          isGracePeriod: false,
          isExpired: false,
          daysRemaining: 9999,
          plan: 'lifetime',
          expiryDate: null
        };
        return this.state;
      }

      // JSON Base64 License
      const { plan, expiry } = res.license;
      if (!expiry) {
        return this.setDefaultState();
      }

      const expiryDate = new Date(expiry);
      const now = new Date();
      
      // Calculate days remaining
      const msDiff = expiryDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(msDiff / (1000 * 60 * 60 * 24));

      const isExpired = msDiff <= 0;
      const isGracePeriod = false; // Grace period removed
      const isActive = msDiff > 0;

      this.state = {
        isActive,
        isGracePeriod,
        isExpired,
        daysRemaining,
        plan: plan || 'monthly',
        expiryDate: expiry
      };

      return this.state;
    } catch (e) {
      console.error("Subscription initialization failed", e);
      return this.setDefaultState();
    }
  }

  public getState(): SubscriptionState {
    if (!this.state) return this.setDefaultState();
    return this.state;
  }

  public canAccess(routeName: string): boolean {
    const s = this.getState();
    // Lifetime or active subscription allows everything
    if (s.plan === 'lifetime' || s.isActive) return true;
    
    // If fully expired, only allow these 2 critical pages as requested
    const allowedWhenExpired = ['subscription', 'settings'];
    return allowedWhenExpired.includes(routeName);
  }

  private setDefaultState(): SubscriptionState {
    this.state = {
      isActive: false,
      isGracePeriod: false,
      isExpired: true,
      daysRemaining: 0,
      plan: 'none',
      expiryDate: null
    };
    return this.state;
  }
}

export const subService = new SubscriptionService();
