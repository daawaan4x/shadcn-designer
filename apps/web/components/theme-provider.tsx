"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"

/**
 * Application theme boundary.
 *
 * Wraps the application to provide Next.js theme support via `next-themes`.
 * Automatically injects the global theme toggle hotkey listener.
 */
function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      <ThemeHotkey />
      {children}
    </NextThemesProvider>
  )
}

/**
 * Checks if the user is currently interacting with an input element.
 *
 * Prevents hotkeys from firing when the user is actively typing in a form field
 * or content-editable area.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  const typingTags = new Set(["INPUT", "TEXTAREA", "SELECT"])
  return target.isContentEditable || typingTags.has(target.tagName)
}

/**
 * Listens for the 'd' keypress to toggle between light and dark themes.
 *
 * Binds a global event listener, safely ignoring keypresses inside input fields
 * or when modifier keys are held.
 */
function ThemeHotkey() {
  const { resolvedTheme, setTheme } = useTheme()

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Ignore key repeats, handled events, or modifier combinations.
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return
      }

      // We only trigger the toggle on the 'd' key.
      if (event.key.toLowerCase() !== "d") return

      // Avoid toggling when the user is typing in an input field.
      if (isTypingTarget(event.target)) return

      setTheme(resolvedTheme === "dark" ? "light" : "dark")
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [resolvedTheme, setTheme])

  return null
}

export { ThemeProvider }
