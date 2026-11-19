import { useEffect, useRef, useState, type RefObject } from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';

/** Anything on screen that can report where it is, like a View's ref. */
type Measurable = { measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void };

/**
 * Where the top edge of the on-screen keyboard is, in window coordinates, or null while it is hidden.
 * The browser sends no keyboard events, so on web this is always null.
 */
export function useKeyboardTop(): number | null {
  const [top, setTop] = useState<number | null>(null);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const shown = (event: KeyboardEvent) => setTop(event.endCoordinates.height > 0 ? event.endCoordinates.screenY : null);
    const subs = [
      Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', shown),
      Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setTop(null)),
      // The keyboard can change height while open, like when the suggestion strip above the keys appears.
      ...(ios ? [Keyboard.addListener('keyboardWillChangeFrame', shown)] : []),
    ];
    return () => subs.forEach((sub) => sub.remove());
  }, []);
  return top;
}

/**
 * How far to lift something at the bottom of the screen so the keyboard doesn't cover it. Measures where it really
 * is, so if the system already moved it out of the way (Android usually does), the lift is 0 and nothing moves twice.
 * Apply the result as a bottom margin on the element `target` points to.
 */
export function useKeyboardLift(target: RefObject<Measurable | null>): number {
  const top = useKeyboardTop();
  const [lift, setLift] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    if (top === null) {
      current.current = 0;
      setLift(0);
      return;
    }
    target.current?.measureInWindow((_x, y, _width, height) => {
      // Where its bottom edge would be with no lift at all.
      const resting = y + height + current.current;
      const next = Math.max(0, Math.round(resting - top));
      current.current = next;
      setLift(next);
    });
  }, [top, target]);
  return lift;
}
