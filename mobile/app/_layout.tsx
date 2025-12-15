import "@/utils/polyfills"; // Must be first to set up global polyfills
import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { AuthProvider } from "@/context/AuthContext";
import { SocketProvider } from "@/context/SocketContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RootLayout() {
    const colorScheme = useColorScheme();

    return (
        <AuthProvider>
            <SocketProvider>
                <SafeAreaView style={{ flex: 1 }}>
                    <ThemeProvider
                        value={
                            colorScheme === "dark" ? DarkTheme : DefaultTheme
                        }
                    >
                        <Stack screenOptions={{ headerShown: false }}>
                            <Stack.Screen name="index" />
                        </Stack>
                        <StatusBar style="auto" />
                    </ThemeProvider>
                </SafeAreaView>
            </SocketProvider>
        </AuthProvider>
    );
}
