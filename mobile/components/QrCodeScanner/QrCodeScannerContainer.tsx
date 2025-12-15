import React from "react";
import ConversationsList from "../ConversationsList";
import QrCodeScanner from "./QrCodeScanner";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/context/AuthContext";

const QrCodeScannerContainer = () => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <View
                style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (isAuthenticated) {
        return <ConversationsList />;
    }

    return <QrCodeScanner />;
};

export default React.memo(QrCodeScannerContainer);
