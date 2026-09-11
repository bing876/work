import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Workbench render failed", error, info);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="error-fallback" role="alert">
        <div>
          <span aria-hidden="true">!</span>
          <h1>工作台暂时无法显示</h1>
          <p>你的内容没有丢失。请重试，或重新加载页面。</p>
          <button type="button" onClick={() => this.setState({ error: null })}>
            重试
          </button>
          <button type="button" onClick={() => window.location.reload()}>
            重新加载
          </button>
        </div>
      </main>
    );
  }
}
