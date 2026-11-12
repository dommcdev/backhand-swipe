import { useSyncExternalStore } from 'react'

export type MessageBoxIcon = 'information' | 'warning' | 'error' | 'question'

export interface MessageBoxRequest {
  text: string
  caption: string
  icon: MessageBoxIcon
  buttons: string[]
  resolve: (button: string) => void
}

let current: MessageBoxRequest | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** MessageBox.Show(text, caption, buttons, icon). Resolves with the label of the button that was clicked. */
export function messageBox(
  text: string,
  { caption = 'Backhand Swipe', icon = 'information', buttons = ['OK'] }: Partial<Omit<MessageBoxRequest, 'text' | 'resolve'>> = {},
) {
  return new Promise<string>((resolve) => {
    current = {
      text,
      caption,
      icon,
      buttons,
      resolve: (button) => {
        current = null
        listeners.forEach((l) => l())
        resolve(button)
      },
    }
    listeners.forEach((l) => l())
  })
}

export const useMessageBox = () => useSyncExternalStore(subscribe, () => current)
