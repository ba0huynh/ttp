import * as React from 'react'

/**
 * Text box state that is mirrored into the URL only after the user stops
 * typing. The box and the filtering use `text` (instant, no router work per
 * keystroke); `commit` (a `navigate` call) runs `delay` ms after the last
 * edit. Changes that come from the URL itself (Back button, a shared link)
 * are copied back into the box.
 */
export function useUrlText(
  urlValue: string,
  commit: (value: string) => void,
  delay = 400,
): [string, (value: string) => void] {
  const [text, setText] = React.useState(urlValue)
  // Last value we pushed to the URL: lets us tell our own update from Back/Forward
  const pushed = React.useRef(urlValue)
  const commitRef = React.useRef(commit)
  commitRef.current = commit

  React.useEffect(() => {
    if (urlValue !== pushed.current) {
      pushed.current = urlValue
      setText(urlValue)
    }
  }, [urlValue])

  React.useEffect(() => {
    if (text === pushed.current) return
    const timer = setTimeout(() => {
      pushed.current = text
      commitRef.current(text)
    }, delay)
    return () => clearTimeout(timer)
  }, [text, delay])

  return [text, setText]
}
