/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */
// Intended use: the error boundary that keeps one failing instrument from taking down the page, reporting what it caught and offering a restart.
import { Component } from "react";
export class ErrorBoundary extends Component {
  state = {
    error: null
  };
  static getDerivedStateFromError(error) {
    return {
      error
    };
  }
  componentDidCatch(error, info) {
    this.props.onError(error, info);
  }
  reset = () => this.setState({
    error: null
  });
  render() {
    return this.state.error ? this.props.fallback(this.state.error, this.reset) : this.props.children;
  }
}