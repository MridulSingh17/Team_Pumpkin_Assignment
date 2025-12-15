import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        justifyContent: "center",
        alignItems: "center",
    },
    title: {
        marginTop: 40,
        marginBottom: 20,
        textAlign: "center",
    },
    cameraContainer: {
        width: "100%",
        height: 300,
        borderRadius: 10,
        overflow: "hidden",
        marginBottom: 20,
    },
    camera: {
        flex: 1,
    },
    button: {
        backgroundColor: "#007AFF",
        padding: 15,
        borderRadius: 10,
        alignItems: "center",
        marginBottom: 20,
    },
    buttonText: {
        color: "white",
        fontSize: 16,
        fontWeight: "bold",
    },
    historyContainer: {
        marginTop: 20,
    },
    historyItem: {
        padding: 10,
        marginTop: 10,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: "#ccc",
    },
    historyText: {
        fontSize: 14,
    },
    historyTimestamp: {
        fontSize: 12,
        marginTop: 5,
        opacity: 0.7,
    },
    loadingOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
    },
    loadingText: {
        marginTop: 10,
        color: "white",
        fontSize: 16,
        fontWeight: "600",
    },
});

export default styles;
