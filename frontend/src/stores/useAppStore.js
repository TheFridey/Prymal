import { create } from 'zustand';

export const useAppStore = create((set, get) => ({
  org: null,
  credits: null,
  notifications: [],
  setSession: (viewer) =>
    set({
      org: viewer?.organisation ?? null,
      credits: viewer?.credits ?? null,
    }),
  setCredits: (credits) => set({ credits }),
  addNotification: (notification) => {
    const id = Date.now();
    const entry = {
      type: 'info',
      duration: 4500,
      ...notification,
      id,
    };

    set((state) => ({ notifications: [...state.notifications, entry] }));
    setTimeout(() => get().removeNotification(id), entry.duration);
  },
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((notification) => notification.id !== id),
    })),
}));
