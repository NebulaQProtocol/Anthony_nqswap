'use client';

import { ConnectionStatus } from './ConnectionStatus';

export function Header() {
    return (
        <header className="header">
            <div className="header-title">
                <h1>nQ-Swap</h1>
                <span className="badge">Real-Time Monitor</span>
            </div>
            <ConnectionStatus />
        </header>
    );
}
