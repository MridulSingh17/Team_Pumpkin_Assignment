import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/context/AuthContext";
import { authApi, handleApiError } from "@/utils/api";
import {
    generateKeyPair,
    storeDeviceId,
    storeKeys,
    retrieveKeys,
} from "@/utils/encryption";
import { saveQRData } from "@/utils/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Camera, CameraView } from "expo-camera";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    Alert,
    Text,
    TouchableOpacity,
    View,
    ActivityIndicator,
    Platform,
} from "react-native";
import styles from "./QrCodeScanner.style";

const QrCodeScanner = () => {
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [scanned, setScanned] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [isPreGeneratingKeys, setIsPreGeneratingKeys] = useState(true);
    const [preGeneratedKeys, setPreGeneratedKeys] = useState<{
        publicKey: string;
        privateKey: string;
    } | null>(null);
    const router = useRouter();
    const { setAuthData } = useAuth();

    useEffect(() => {
        const getCameraPermissions = async () => {
            const { status } = await Camera.requestCameraPermissionsAsync();
            setHasPermission(status === "granted");
        };

        const preGenerateKeys = async () => {
            setIsPreGeneratingKeys(true);
            try {
                // First check if keys already exist
                const existingKeys = await retrieveKeys();
                if (existingKeys) {
                    setPreGeneratedKeys(existingKeys);
                } else {
                    const keys = await generateKeyPair();
                    setPreGeneratedKeys(keys);
                }
            } catch (error) {
                console.error("❌ Failed to pre-generate keys:", error);
            } finally {
                setIsPreGeneratingKeys(false);
            }
        };

        getCameraPermissions();
        preGenerateKeys();
    }, []);

    const handleBarCodeScanned = async ({
        type,
        data,
    }: {
        type: string;
        data: string;
    }) => {
        setScanned(true);

        try {
            // Save the scanned QR data to local storage
            await saveQRData({
                type,
                data,
                timestamp: new Date().toISOString(),
            });

            // Check if this is a QR login token (UUID format)
            const uuidRegex =
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

            if (uuidRegex.test(data)) {
                Alert.alert(
                    "QR Login Detected",
                    "This appears to be a login QR code. Do you want to login with this device?",
                    [
                        {
                            text: "Cancel",
                            style: "cancel",
                            onPress: () => {
                                setScanned(false);
                            },
                        },
                        {
                            text: "Login",
                            onPress: async () => {
                                try {
                                    setIsLoggingIn(true);

                                    // Use pre-generated keys or generate new ones
                                    let keys;
                                    if (preGeneratedKeys) {
                                        keys = preGeneratedKeys;
                                    } else {
                                        try {
                                            keys = await generateKeyPair();
                                        } catch (keyError) {
                                            console.error(
                                                "❌ Key generation failed:",
                                                keyError
                                            );
                                            throw new Error(
                                                "Failed to generate encryption keys: " +
                                                    keyError
                                            );
                                        }
                                    }

                                    // Determine device type
                                    const deviceType =
                                        Platform.OS === "ios"
                                            ? "ios"
                                            : "android";
                                    const response = await authApi.qrLogin({
                                        token: data,
                                        deviceType,
                                        publicKey: keys.publicKey,
                                    });

                                    if (response.success) {
                                        await AsyncStorage.setItem(
                                            "token",
                                            response.data.accessToken
                                        );
                                        await AsyncStorage.setItem(
                                            "refreshToken",
                                            response.data.refreshToken
                                        );
                                        await AsyncStorage.setItem(
                                            "user",
                                            JSON.stringify(response.data.user)
                                        );
                                        await storeKeys(
                                            keys.publicKey,
                                            keys.privateKey
                                        );
                                        await storeDeviceId(
                                            response.data.device._id
                                        );
                                        setAuthData(
                                            response.data.user,
                                            response.data.accessToken
                                        );
                                        setIsLoggingIn(false);
                                        router.replace("/chat");
                                    } else {
                                        console.error(
                                            "❌ Login failed - response.success is false"
                                        );
                                        throw new Error(
                                            response.message || "Login failed"
                                        );
                                    }
                                } catch (error) {
                                    console.error("❌ QR Login error:", error);
                                    setIsLoggingIn(false);
                                    const errorMessage = handleApiError(error);
                                    console.error(
                                        "❌ Error message:",
                                        errorMessage
                                    );
                                    Alert.alert("Login Failed", errorMessage, [
                                        {
                                            text: "Try Again",
                                            onPress: () => setScanned(false),
                                        },
                                    ]);
                                }
                            },
                        },
                    ]
                );
            }
        } catch {
            Alert.alert("Error", "Failed to process QR code data");
            setScanned(false);
        }
    };

    if (hasPermission === null) {
        return (
            <ThemedView style={styles.container}>
                <ThemedText>Requesting camera permission...</ThemedText>
            </ThemedView>
        );
    }

    if (hasPermission === false) {
        return (
            <ThemedView style={styles.container}>
                <ThemedText>No access to camera</ThemedText>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <View style={styles.cameraContainer}>
                <CameraView
                    style={styles.camera}
                    facing="back"
                    onBarcodeScanned={
                        scanned ? undefined : handleBarCodeScanned
                    }
                    barcodeScannerSettings={{
                        barcodeTypes: ["qr"],
                    }}
                />
                {isLoggingIn && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color="#007AFF" />
                        <ThemedText style={styles.loadingText}>
                            Logging in...
                        </ThemedText>
                    </View>
                )}
            </View>
            {isPreGeneratingKeys && (
                <ThemedText
                    style={{ marginTop: 10, textAlign: "center", opacity: 0.7 }}
                >
                    🔑 Preparing encryption keys...
                </ThemedText>
            )}

            {!isPreGeneratingKeys && preGeneratedKeys && (
                <ThemedText
                    style={{
                        marginTop: 10,
                        textAlign: "center",
                        opacity: 0.7,
                        color: "green",
                    }}
                >
                    ✅ Ready for QR login
                </ThemedText>
            )}
            {scanned && !isLoggingIn && (
                <TouchableOpacity
                    style={styles.button}
                    onPress={() => setScanned(false)}
                >
                    <Text style={styles.buttonText}>Tap to Scan Again</Text>
                </TouchableOpacity>
            )}
        </ThemedView>
    );
};

export default React.memo(QrCodeScanner);
