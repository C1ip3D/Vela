import React from "react";

interface TestEmailProps {
    email: string;
}

export const TestEmail: React.FC<TestEmailProps> = ({ email }) => {
    return (
        <div
            style={{
                backgroundColor: "#0C1220",
                color: "#E8ECFF",
                fontFamily:
                    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                padding: "40px 20px",
                margin: "0 auto",
            }}
        >
            <div
                style={{
                    maxWidth: "600px",
                    margin: "0 auto",
                    backgroundColor: "#101828",
                    border: "1px solid rgba(28, 42, 69, 0.6)",
                    borderRadius: "12px",
                    overflow: "hidden",
                }}
            >
                {/* Header */}
                <div
                    style={{
                        backgroundColor: "#162032",
                        padding: "24px",
                        borderBottom: "1px solid rgba(28, 42, 69, 0.6)",
                        textAlign: "center",
                    }}
                >
                    <h1 style={{ margin: 0, color: "#E8ECFF", fontSize: "24px", fontWeight: "600" }}>
                        Vela <span style={{ color: "#818CF8", fontWeight: "400" }}>Academic</span>
                    </h1>
                </div>

                {/* Content */}
                <div style={{ padding: "32px", fontSize: "16px", lineHeight: "1.6", color: "#B3C1E6" }}>
                    <h2 style={{ color: "#E8ECFF", marginTop: 0, fontSize: "20px" }}>
                        Test Alert Successful!
                    </h2>
                    <p>Hello,</p>
                    <p>
                        This is a test notification verifying that your email preferences are properly configured
                        for `<span style={{ color: "#818CF8", fontWeight: "bold" }}>{email}</span>`.
                    </p>

                    <div
                        style={{
                            backgroundColor: "rgba(52, 199, 89, 0.1)",
                            border: "1px solid rgba(52, 199, 89, 0.3)",
                            borderRadius: "8px",
                            padding: "16px",
                            marginTop: "24px",
                            marginBottom: "24px",
                        }}
                    >
                        <p style={{ margin: 0, color: "#34C759", fontWeight: "500" }}>
                            ✅ You are now ready to receive personalized GPA drops, missing assignments, and
                            counselor alerts straight to your inbox.
                        </p>
                    </div>

                    <p>
                        You can adjust your notification preferences or add a Telegram Chat ID within the Vela Settings page
                        on your dashboard at any time.
                    </p>

                    <div style={{ marginTop: "32px", textAlign: "center" }}>
                        <a
                            href="http://localhost:3000/settings"
                            style={{
                                display: "inline-block",
                                backgroundColor: "#818CF8",
                                color: "#ffffff",
                                padding: "12px 24px",
                                borderRadius: "8px",
                                textDecoration: "none",
                                fontWeight: "600",
                                fontSize: "14px",
                            }}
                        >
                            Manage Preferences
                        </a>
                    </div>
                </div>

                {/* Footer */}
                <div
                    style={{
                        padding: "24px",
                        textAlign: "center",
                        fontSize: "12px",
                        color: "#64748B",
                        borderTop: "1px solid rgba(28, 42, 69, 0.4)",
                    }}
                >
                    <p style={{ margin: 0 }}>© 2026 Vela Academic Navigator. All rights reserved.</p>
                    <p style={{ margin: "4px 0 0 0" }}>San Francisco, CA</p>
                </div>
            </div>
        </div>
    );
};

import { renderToStaticMarkup } from "react-dom/server";

export const renderTestEmail = (email: string) => {
    return renderToStaticMarkup(<TestEmail email={email} />);
};
