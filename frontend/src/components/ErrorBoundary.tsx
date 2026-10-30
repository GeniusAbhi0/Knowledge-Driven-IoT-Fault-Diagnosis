import { Component, type ErrorInfo, type ReactNode } from "react";

/** Keeps a failing visual (e.g. WebGL) from taking the whole page down. */
export default class ErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: Error, info: ErrorInfo) { console.warn("Visual component failed:", err.message, info.componentStack); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
