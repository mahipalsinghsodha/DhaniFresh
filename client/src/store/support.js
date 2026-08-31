// store/support.js — Global Zustand store for Zomato-style Support Popup
import { create } from 'zustand'

export const useSupportStore = create((set) => ({
  isOpen: false,
  order: null,
  initialCategory: 'OTHER',

  openSupport: (order = null, category = 'OTHER') => {
    set({ isOpen: true, order: order || null, initialCategory: order ? 'ORDER' : category })
  },

  closeSupport: () => {
    set({ isOpen: false, order: null, initialCategory: 'OTHER' })
  },
}))
