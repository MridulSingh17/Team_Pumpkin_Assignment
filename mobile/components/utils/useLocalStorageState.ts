import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from "react";

const useLocalStorageState = () => {
    const [item, getItem] = useState<string | null>(null);

    const setItemToLocalStorage = async (key: string, value: string) => {
        try {
            await AsyncStorage.setItem(key, value);
        } catch (error) {
            console.error('Error setting item:', error);
        }
    };

    const getItemFromLocalStorage = async (key: string) => {
        try {
            const value = await AsyncStorage.getItem(key);
            getItem(value);
        } catch (error) {
            console.error('Error getting item:', error);
        }
    };

    return {  setItemToLocalStorage, item, getItemFromLocalStorage };
};

export default useLocalStorageState;
