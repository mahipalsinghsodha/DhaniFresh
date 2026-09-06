// store/notifications.js — Zustand notification store
import { create } from 'zustand'
import api from '../api/axios'

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isDrawerOpen: false,

  setNotifications: (notifications) => {
    const unread = (notifications || []).filter(n => !n.isRead)
    set({ notifications: unread, unreadCount: unread.length })
  },

  addNotification: (notification) => {
    if (notification.isRead) return
    set(state => ({
      notifications: [notification, ...state.notifications.filter(n => n._id !== notification._id)],
      unreadCount: state.unreadCount + 1,
    }))
  },

  markRead: async (id) => {
    // Optimistic update: immediately remove notification once read
    set(state => {
      const removed = state.notifications.find(n => n._id === id)
      return {
        notifications: state.notifications.filter(n => n._id !== id),
        unreadCount: removed && !removed.isRead
          ? Math.max(0, state.unreadCount - 1)
          : Math.max(0, state.notifications.length - 1),
      }
    })
    try {
      await api.patch(`/api/notifications/${id}/read`)
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
    }
  },

  markAllRead: async () => {
    // Optimistic update: clear all notifications immediately
    set({
      notifications: [],
      unreadCount: 0,
    })
    try {
      await api.patch('/api/notifications/read-all')
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err)
    }
  },

  removeNotification: async (id) => {
    // Optimistic update: remove notification
    set(state => {
      const removed = state.notifications.find(n => n._id === id)
      return {
        notifications: state.notifications.filter(n => n._id !== id),
        unreadCount: removed && !removed.isRead
          ? Math.max(0, state.unreadCount - 1)
          : Math.max(0, state.notifications.length - 1),
      }
    })
    try {
      await api.delete(`/api/notifications/${id}`)
    } catch (err) {
      console.error('Failed to delete notification:', err)
    }
  },

  toggleDrawer: () => set(state => ({ isDrawerOpen: !state.isDrawerOpen })),
  closeDrawer:  () => set({ isDrawerOpen: false }),
  openDrawer:   () => set({ isDrawerOpen: true }),
}))
