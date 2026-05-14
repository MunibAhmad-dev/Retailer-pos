export interface SubscriptionState {
  isActive: boolean;
  isGracePeriod: boolean;
  isExpired: boolean;
  daysRemaining: number;
  plan: 'weekly' | 'monthly' | 'yearly' | 'custom' | 'lifetime' | 'none';
  expiryDate: string | null;
  lastSync: string | null;
  cloudConnected: boolean;
  licenseMode: 'online' | 'offline';
  approvalStatus: 'approved' | 'pending' | 'blocked';
  internetReminder: boolean;
}

class SubscriptionService {
  private state: SubscriptionState | null = null;
  private readonly GRACE_PERIOD_DAYS = 0; // Strictly enforced

  private refreshTemporalState(state: SubscriptionState): SubscriptionState {
    if (!state.expiryDate || state.plan === 'lifetime') return state;

    const msDiff = new Date(state.expiryDate).getTime() - Date.now();
    const daysRemaining = Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));
    const currentlyActive = msDiff > 0 && (state.licenseMode !== 'online' || state.approvalStatus === 'approved');

    return {
      ...state,
      daysRemaining,
      isActive: currentlyActive,
      isExpired: !currentlyActive
    };
  }

  public async initialize(): Promise<SubscriptionState> {
    try {
      const settingsRes = await (window as any).api.getSettings?.();
      const settings = settingsRes?.success ? settingsRes.data : null;
      const licenseMode: 'online' | 'offline' = settings?.license_mode === 'online' ? 'online' : 'offline';
      const approvalStatus: 'approved' | 'pending' | 'blocked' =
        settings?.approval_status === 'blocked' ? 'blocked' :
        settings?.approval_status === 'pending' ? 'pending' : 'approved';

      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
      const cloudConnected = !!settings?.cloud_connected;
      const res = await (window as any).api.isActivated();
      
      if (!res.success || !res.activated) {
        return this.setDefaultState(cloudConnected, licenseMode, approvalStatus, settings?.last_online_check || null);
      }

      // Legacy MD5 license logic (No expiry date) -> Lifetime
      if (!res.license || res.license.isLegacy) {
        this.state = {
          isActive: true,
          isGracePeriod: false,
          isExpired: false,
          daysRemaining: 9999,
          plan: 'lifetime',
          expiryDate: null,
          lastSync: new Date().toISOString(),
          cloudConnected,
          licenseMode,
          approvalStatus,
          internetReminder: false
        };
        return this.state;
      }

      // V2 encrypted license payload or legacy JSON payload
      const license = res.license || {};
      const expiry = license.expiresAt || license.expiry || null;
      if (!expiry) {
        return this.setDefaultState(cloudConnected, licenseMode, approvalStatus);
      }

      const expiryDate = new Date(expiry);
      const now = new Date();
      
      // Calculate days remaining
      const msDiff = expiryDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(msDiff / (1000 * 60 * 60 * 24));

      const isExpired = msDiff <= 0;
      const isGracePeriod = false; // Grace period removed
      const isActive = msDiff > 0;

      let effectiveActive = isActive;
      if (licenseMode === 'online') {
        // In online mode, admin status controls access.
        effectiveActive = isActive && approvalStatus === 'approved';
      }

      if (licenseMode === 'online' && online && (window as any).api.updateSettings) {
        try {
          await (window as any).api.updateSettings({ last_online_check: new Date().toISOString() });
        } catch {}
      }

      const lastOnlineCheck = settings?.last_online_check ? new Date(settings.last_online_check).getTime() : 0;
      const tenDaysMs = 10 * 24 * 60 * 60 * 1000;
      const internetReminder = licenseMode === 'online' && !online && (!!lastOnlineCheck && (Date.now() - lastOnlineCheck > tenDaysMs));

      let plan: SubscriptionState['plan'] = 'custom';
      const d = Number(license.durationDays || 0);
      if (d === 7) plan = 'weekly';
      else if (d >= 28 && d <= 31) plan = 'monthly';
      else if (d >= 360 && d <= 366) plan = 'yearly';

      this.state = {
        isActive: effectiveActive,
        isGracePeriod,
        isExpired: !effectiveActive,
        daysRemaining,
        plan,
        expiryDate: expiry,
        lastSync: new Date().toISOString(),
        cloudConnected,
        licenseMode,
        approvalStatus,
        internetReminder
      };

      return this.state;
    } catch (e) {
      console.error("Subscription initialization failed", e);
      return this.setDefaultState(false, 'offline', 'approved', null);
    }
  }

  public getState(): SubscriptionState {
    if (!this.state) return this.setDefaultState(false, 'offline', 'approved');
    this.state = this.refreshTemporalState(this.state);
    return this.state;
  }

  public canAccess(routeName: string): boolean {
    const s = this.getState();
    // Lifetime or active subscription allows everything
    if (s.plan === 'lifetime' || s.isActive) return true;
    
    // If fully expired, only allow these 2 critical pages as requested
    const allowedWhenExpired = ['sales', 'subscription'];
    return allowedWhenExpired.includes(routeName);
  }

  public isSubscriptionActive(): boolean {
    const s = this.getState();
    return s.plan === 'lifetime' || s.isActive;
  }

  public getDaysRemaining(): number {
    const s = this.getState();
    return s.plan === 'lifetime' ? 9999 : Math.max(0, s.daysRemaining || 0);
  }

  public getSubscriptionStatus(): SubscriptionState {
    return this.getState();
  }

  private setDefaultState(
    cloudConnected = false,
    licenseMode: 'online' | 'offline' = 'offline',
    approvalStatus: 'approved' | 'pending' | 'blocked' = 'approved',
    lastOnlineCheck: string | null = null
  ): SubscriptionState {
    const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const lastTs = lastOnlineCheck ? new Date(lastOnlineCheck).getTime() : 0;
    const internetReminder = licenseMode === 'online' && !online && !!lastTs && (Date.now() - lastTs > 10 * 24 * 60 * 60 * 1000);
    this.state = {
      isActive: false,
      isGracePeriod: false,
      isExpired: true,
      daysRemaining: 0,
      plan: 'none',
      expiryDate: null,
      lastSync: null,
      cloudConnected,
      licenseMode,
      approvalStatus,
      internetReminder
    };
    return this.state;
  }
}

export const subService = new SubscriptionService();
