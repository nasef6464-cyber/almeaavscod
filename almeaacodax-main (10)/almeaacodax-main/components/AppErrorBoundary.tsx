import * as React from 'react';
import { reportClientEvent } from '../services/clientTelemetry';

type Props = {
    children: React.ReactNode;
};

type State = {
    hasError: boolean;
};

export class AppErrorBoundary extends React.Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: unknown, info: React.ErrorInfo) {
        console.error('App error boundary caught:', error);
        const errorObject = error instanceof Error ? error : new Error(String(error || 'Unknown app error'));
        void reportClientEvent({
            source: 'error-boundary',
            severity: 'error',
            message: errorObject.message || 'App error boundary caught an error',
            stack: errorObject.stack,
            metadata: {
                componentStack: info.componentStack,
            },
        });
    }

    private recoverToHome = () => {
        this.setState({ hasError: false });
        window.location.hash = '#/';
    };

    private reloadPage = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6 text-center">
                    <div className="max-w-lg rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
                        <h1 className="text-2xl font-black text-gray-900">حدث خلل في الصفحة</h1>
                        <p className="mt-3 text-sm leading-7 text-gray-600">
                            لم نستطع عرض هذا الجزء الآن. يمكنك الرجوع للرئيسية أو إعادة تحميل الصفحة، ولن يؤثر ذلك على بياناتك المحفوظة.
                        </p>
                        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                            <button
                                type="button"
                                onClick={this.recoverToHome}
                                className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white hover:bg-indigo-700"
                            >
                                الرجوع للرئيسية
                            </button>
                            <button
                                type="button"
                                onClick={this.reloadPage}
                                className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-black text-gray-700 hover:bg-gray-50"
                            >
                                إعادة التحميل
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
