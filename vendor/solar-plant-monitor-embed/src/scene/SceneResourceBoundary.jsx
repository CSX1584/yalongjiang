import { Component } from 'react'

export class SceneResourceBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidUpdate(previousProps) {
    if (
      previousProps.resetKey !== this.props.resetKey &&
      this.state.failed
    ) {
      this.setState({ failed: false })
    }
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children
  }
}

