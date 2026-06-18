import React, { useState, useEffect, useRef } from 'react';
import {
  Text, View, StyleSheet, TextInput,
  TouchableOpacity, Alert, ScrollView, Modal, ActivityIndicator
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { supabase } from './supabase';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import axios from 'axios';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// 🔑 REPLACE THIS WITH YOUR GOOGLE CLOUD VISION API KEY
const GOOGLE_VISION_API_KEY = 'AIzaSyDoKvU44AHURJkVgl5GnVzB0ktfnDIhDFo';

// =============================================
// SOUTH AFRICA PROVINCE & MUNICIPALITY DATA
// =============================================
const provinces = [
  { id: 'ec', name: 'Eastern Cape' },
  { id: 'fs', name: 'Free State' },
  { id: 'gp', name: 'Gauteng' },
  { id: 'kzn', name: 'KwaZulu-Natal' },
  { id: 'lp', name: 'Limpopo' },
  { id: 'mp', name: 'Mpumalanga' },
  { id: 'nc', name: 'Northern Cape' },
  { id: 'nw', name: 'North West' },
  { id: 'wc', name: 'Western Cape' },
];

const municipalities = {
  ec: [
    'Buffalo City', 'Nelson Mandela Bay', 'Chris Hani', 'Joe Gqabi',
    'OR Tambo', 'Alfred Nzo', 'Amathole', 'Sarah Baartman'
  ],
  fs: [
    'Mangaung', 'Lejweleputswa', 'Fezile Dabi', 'Thabo Mofutsanyana', 'Xhariep'
  ],
  gp: [
    'City of Johannesburg', 'City of Tshwane', 'Ekurhuleni', 'Sedibeng', 'West Rand'
  ],
  kzn: [
    'eThekwini', 'Ugu', 'Umgungundlovu', 'Uthukela', 'Umzinyathi',
    'Amajuba', 'Zululand', 'Umkhanyakude', 'King Cetshwayo',
    'Uthungulu', 'Ilembe', 'Harry Gwala'
  ],
  lp: [
    'Capricorn', 'Mopani', 'Sekhukhune', 'Vhembe', 'Waterberg'
  ],
  mp: [
    'Ehlanzeni', 'Gert Sibande', 'Nkangala'
  ],
  nc: [
    'Frances Baard', 'John Taolo Gaetsewe', 'Namakwa', 'Pixley ka Seme', 'ZF Mgcawu'
  ],
  nw: [
    'Bojanala', 'Ngaka Modiri Molema', 'Dr Ruth Segomotsi Mompati', 'Dr Kenneth Kaunda'
  ],
  wc: [
    'City of Cape Town', 'Cape Winelands', 'Central Karoo', 'Garden Route', 'Overberg', 'West Coast'
  ],
};

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: false,
  } as any),
});

// =============================================
// THEME DEFINITIONS
// =============================================

export const LightTheme = {
  background: '#ffffff',
  text: '#000000',
  card: '#f0f8ff',
  cardText: '#000000',
  input: '#ffffff',
  inputBorder: '#cccccc',
  inputText: '#000000',
  button: '#007bff',
  buttonText: '#ffffff',
  header: '#ffffff',
  headerText: '#000000',
  border: '#eeeeee',
  shadow: '#000000',
  subtitle: '#666666',
  modalOverlay: 'rgba(0,0,0,0.5)',
  modalContent: '#ffffff',
  smallButton: '#007bff',
  pickerBackground: '#ffffff',
};

export const DarkTheme = {
  background: '#1a1a2e',
  text: '#ffffff',
  card: '#16213e',
  cardText: '#ffffff',
  input: '#2a2a4a',
  inputBorder: '#444466',
  inputText: '#ffffff',
  button: '#0d6efd',
  buttonText: '#ffffff',
  header: '#1a1a2e',
  headerText: '#ffffff',
  border: '#333355',
  shadow: '#000000',
  subtitle: '#aaaaaa',
  modalOverlay: 'rgba(0,0,0,0.8)',
  modalContent: '#2a2a4a',
  smallButton: '#0d6efd',
  pickerBackground: '#2a2a4a',
};

export default function App() {
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [theme, setTheme] = useState(LightTheme);

  // Authentication state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [expoPushToken, setExpoPushToken] = useState('');

  // Meter state
  const [meterNumber, setMeterNumber] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [registeredMeters, setRegisteredMeters] = useState<any[]>([]);
  const [selectedMeter, setSelectedMeter] = useState<any>(null);

  // Province & Municipality selection state
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedMunicipality, setSelectedMunicipality] = useState('');
  const [filteredMunicipalities, setFilteredMunicipalities] = useState<string[]>([]);

  // Purchase state
  const [units, setUnits] = useState('');
  const [amount, setAmount] = useState('');
  const [tokenCode, setTokenCode] = useState('');
  const [purchases, setPurchases] = useState<any[]>([]);
  const [estimatedBalance, setEstimatedBalance] = useState(0);

  // Screen state
  const [currentScreen, setCurrentScreen] = useState('login');

  // Balance update state
  const [currentReading, setCurrentReading] = useState('');
  const [showReadingInput, setShowReadingInput] = useState(false);

  // Camera and scanning state
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [scanMode, setScanMode] = useState<'meter' | 'receipt'>('meter');
  const [ocrLoading, setOcrLoading] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // Load theme preference on mount
  useEffect(() => {
    loadThemePreference();
    checkUser();
    setupNotifications();
  }, []);

  // Apply theme whenever it changes
  useEffect(() => {
    setTheme(isDarkMode ? DarkTheme : LightTheme);
    saveThemePreference(isDarkMode);
  }, [isDarkMode]);

  // Check alerts when balance or purchases change
  useEffect(() => {
    if (isLoggedIn) {
      checkAndSendAlerts();
    }
  }, [estimatedBalance, purchases, isLoggedIn]);

  // =============================================
  // THEME FUNCTIONS
  // =============================================

  async function loadThemePreference() {
    try {
      const savedTheme = await AsyncStorage.getItem('isDarkMode');
      if (savedTheme !== null) {
        setIsDarkMode(savedTheme === 'true');
      }
    } catch (error) {
      console.log('Error loading theme:', error);
    }
  }

  async function saveThemePreference(isDark: boolean) {
    try {
      await AsyncStorage.setItem('isDarkMode', String(isDark));
    } catch (error) {
      console.log('Error saving theme:', error);
    }
  }

  function toggleTheme() {
    setIsDarkMode(!isDarkMode);
  }

  // =============================================
  // PROVINCE & MUNICIPALITY FUNCTIONS
  // =============================================

  function handleProvinceSelect(provinceId: string) {
    setSelectedProvince(provinceId);
    setSelectedMunicipality('');
    const munis = municipalities[provinceId as keyof typeof municipalities] || [];
    setFilteredMunicipalities(munis);
  }

  // =============================================
  // STYLES WITH THEME SUPPORT
  // =============================================

  const styles = getStyles(theme);

  // =============================================
  // EXPORT FUNCTIONS
  // =============================================

  async function exportHistory() {
    if (purchases.length === 0) {
      Alert.alert('No Data', 'No purchases to export. Add some purchases first!');
      return;
    }

    try {
      setLoading(true);

      // Create CSV content
      let csv = 'Date,Units (kWh),Amount (R),Token Code\n';
      let totalUnits = 0;
      let totalAmount = 0;

      // Sort purchases by date (oldest first for chronological report)
      const sortedPurchases = [...purchases].reverse();

      sortedPurchases.forEach((p) => {
        const date = new Date(p.purchase_date).toLocaleDateString('en-ZA');
        csv += `${date},${p.units},${p.amount},${p.token_code || ''}\n`;
        totalUnits += p.units;
        totalAmount += p.amount;
      });

      // Add summary at the end
      csv += `\nSummary\n`;
      csv += `Total Units Purchased: ${totalUnits.toFixed(2)} kWh\n`;
      csv += `Total Amount Spent: R${totalAmount.toFixed(2)}\n`;
      csv += `Number of Purchases: ${purchases.length}\n`;

      if (selectedMeter) {
        csv += `\nMeter Details\n`;
        csv += `Meter Number: ${selectedMeter.meter_number}\n`;
        csv += `Municipality: ${selectedMeter.municipality || 'Not set'}\n`;
        csv += `Current Estimated Balance: ${estimatedBalance.toFixed(2)} kWh\n`;
      }

      csv += `\nReport Generated: ${new Date().toLocaleString('en-ZA')}`;

      // Save to file
      const fileName = `meter_history_${new Date().toISOString().split('T')[0]}.csv`;
      const fileUri = FileSystem.documentDirectory + fileName;

      console.log('📁 Saving file to:', fileUri);
      await FileSystem.writeAsStringAsync(fileUri, csv);

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device');
        setLoading(false);
        return;
      }

      // Share the file
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Purchase History',
        UTI: 'public.comma-separated-values-text',
      });

      setLoading(false);
    } catch (error: any) {
      console.error('Export Error:', error);
      Alert.alert('Export Error', 'Failed to export history. Please try again.');
      setLoading(false);
    }
  }

  // =============================================
  // NOTIFICATION FUNCTIONS
  // =============================================

  async function setupNotifications() {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Notification permissions not granted');
        return;
      }

      const token = await Notifications.getExpoPushTokenAsync();
      setExpoPushToken(token.data);
      console.log('📱 Push Token:', token.data);

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('alerts', {
          name: 'Meter Alerts',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }
    } catch (error) {
      console.log('Notification setup error:', error);
    }
  }

  async function checkAndSendAlerts() {
    try {
      const now = new Date().toISOString().split('T')[0];

      if (estimatedBalance < 20 && estimatedBalance > 0) {
        const lastLowBalanceAlert = await AsyncStorage.getItem('lastLowBalanceAlert');
        if (lastLowBalanceAlert !== now) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: '⚡ Low Balance Alert',
              body: `Your estimated balance is ${estimatedBalance.toFixed(2)} kWh. Time to buy more electricity!`,
              data: { screen: 'addPurchase' },
            },
            trigger: null,
          });
          await AsyncStorage.setItem('lastLowBalanceAlert', now);
          console.log('📨 Low balance alert sent');
        }
      }

      if (purchases.length > 0) {
        const lastPurchase = new Date(purchases[0].purchase_date);
        const daysSinceLastPurchase = Math.floor((Date.now() - lastPurchase.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceLastPurchase > 30) {
          const lastInactivityAlert = await AsyncStorage.getItem('lastInactivityAlert');
          if (lastInactivityAlert !== now) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '📅 Inactivity Alert',
                body: `You haven't purchased electricity in ${daysSinceLastPurchase} days. Tap to buy now.`,
                data: { screen: 'addPurchase' },
              },
              trigger: null,
            });
            await AsyncStorage.setItem('lastInactivityAlert', now);
            console.log('📨 Inactivity alert sent');
          }
        }
      }

      const lastTidReminder = await AsyncStorage.getItem('lastTidReminder');
      if (!lastTidReminder || lastTidReminder !== now) {
        if (!lastTidReminder || new Date(lastTidReminder) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: '🔄 TID Update Reminder',
              body: 'Check if your meter needs a TID update. The deadline is November 24, 2024!',
              data: { screen: 'tidGuidance' },
            },
            trigger: null,
          });
          await AsyncStorage.setItem('lastTidReminder', now);
          console.log('📨 TID reminder sent');
        }
      }
    } catch (error) {
      console.log('Alert check error:', error);
    }
  }

  // =============================================
  // GOOGLE CLOUD VISION OCR
  // =============================================

  async function performOCR(imageUri: string): Promise<string> {
    try {
      console.log('📷 Starting OCR for image:', imageUri);

      const base64Image = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log('✅ Image read successfully, base64 length:', base64Image.length);

      console.log('📤 Sending request to Google Cloud Vision API...');

      const response = await axios.post(
        `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
        {
          requests: [
            {
              image: {
                content: base64Image,
              },
              features: [
                {
                  type: 'TEXT_DETECTION',
                  maxResults: 10,
                },
              ],
            },
          ],
        }
      );

      console.log('📥 Response status:', response.status);

      if (response.data.responses && response.data.responses[0]) {
        const text = response.data.responses[0].fullTextAnnotation?.text || '';
        console.log('📝 Detected text:', text || 'No text found');
        return text;
      } else {
        console.log('❌ No responses in API result');
        return '';
      }
    } catch (error: any) {
      console.error('❌ OCR Error:', error);
      if (error.response) {
        console.error('📄 API Error Response:', error.response.data);
        console.error('📄 Status:', error.response.status);
      }
      return '';
    }
  }

  // =============================================
  // AUTHENTICATION FUNCTIONS
  // =============================================

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setIsLoggedIn(true);
      setCurrentScreen('dashboard');
      fetchMeters();
    }
  }

  async function signUp() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      Alert.alert('Sign Up Error', error.message);
    } else {
      Alert.alert('Success', 'Account created! Please sign in.');
      setCurrentScreen('login');
    }
    setLoading(false);
  }

  async function signIn() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      Alert.alert('Sign In Error', error.message);
    } else {
      setIsLoggedIn(true);
      setCurrentScreen('dashboard');
      fetchMeters();
    }
    setLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setCurrentScreen('login');
    setEmail('');
    setPassword('');
    setRegisteredMeters([]);
    setSelectedMeter(null);
    setPurchases([]);
  }

  // =============================================
  // DATABASE FUNCTIONS
  // =============================================

  async function fetchMeters() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('meters')
      .select('*')
      .eq('user_id', user.id);
    if (!error && data) {
      setRegisteredMeters(data);
      if (data.length > 0 && !selectedMeter) {
        setSelectedMeter(data[0]);
        fetchPurchases(data[0].id);
      }
    }
  }

  async function addMeter() {
    if (!meterNumber || meterNumber.length < 10) {
      Alert.alert('Error', 'Please enter a valid meter number (at least 10 digits)');
      return;
    }

    if (!selectedMunicipality) {
      Alert.alert('Error', 'Please select a municipality');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setLoading(true);
    const { error } = await supabase
      .from('meters')
      .insert([{
        meter_number: meterNumber,
        municipality: selectedMunicipality,
        province: selectedProvince,
        user_id: user.id
      }]);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Meter added!');
      setMeterNumber('');
      setMunicipality('');
      setSelectedProvince('');
      setSelectedMunicipality('');
      setFilteredMunicipalities([]);
      setCurrentScreen('dashboard');
      fetchMeters();
    }
    setLoading(false);
  }

  async function fetchPurchases(meterId: number) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .eq('meter_id', meterId)
      .order('purchase_date', { ascending: false });
    if (!error && data) {
      setPurchases(data);
      let totalUnits = 0;
      data.forEach(p => totalUnits += p.units);
      setEstimatedBalance(totalUnits);
    }
  }

  async function addPurchase() {
    if (!units || !amount) {
      Alert.alert('Error', 'Please enter units and amount');
      return;
    }
    if (!selectedMeter) {
      Alert.alert('Error', 'No meter selected');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from('purchases')
      .insert([{
        user_id: user.id,
        meter_id: selectedMeter.id,
        units: parseFloat(units),
        amount: parseFloat(amount),
        token_code: tokenCode,
      }]);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Purchase added!');
      setUnits('');
      setAmount('');
      setTokenCode('');
      setCurrentScreen('dashboard');
      fetchPurchases(selectedMeter.id);
    }
    setLoading(false);
  }

  // =============================================
  // CAMERA FUNCTIONS
  // =============================================

  async function scanMeterNumber() {
    if (!cameraPermission?.granted) {
      const granted = await requestCameraPermission();
      if (!granted) {
        Alert.alert('Permission Needed', 'Camera permission is required to scan meter numbers');
        return;
      }
    }
    setScanMode('meter');
    setCameraVisible(true);
  }

  async function scanReceipt() {
    if (!cameraPermission?.granted) {
      const granted = await requestCameraPermission();
      if (!granted) {
        Alert.alert('Permission Needed', 'Camera permission is required to scan receipts');
        return;
      }
    }
    setScanMode('receipt');
    setReceiptVisible(true);
  }

  async function takePhoto() {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: true,
        });
        if (photo) {
          setOcrLoading(true);
          if (scanMode === 'meter') {
            await handleMeterCapture(photo);
          } else {
            await handleReceiptCapture(photo);
          }
          setOcrLoading(false);
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to take photo. Please try again.');
        setOcrLoading(false);
      }
    }
  }

  // =============================================
  // METER SCAN FUNCTIONS
  // =============================================

  async function handleMeterCapture(image: any) {
    setScanning(true);
    setCameraVisible(false);

    try {
      Alert.alert('Scanning', 'Reading meter number from image...');

      const text = await performOCR(image.uri);
      console.log('📝 OCR Result:', text);

      if (text) {
        const meterMatch = text.match(/\d{10,12}/);

        if (meterMatch) {
          setMeterNumber(meterMatch[0]);
          Alert.alert('✅ Success', `Meter number ${meterMatch[0]} detected and filled!`);
        } else {
          const anyNumber = text.match(/\d{8,}/);
          if (anyNumber) {
            Alert.alert(
              'Number Found',
              `Found "${anyNumber[0]}". Is this your meter number?`,
              [
                {
                  text: 'No',
                  style: 'cancel',
                  onPress: () => promptManualEntry('meter'),
                },
                {
                  text: 'Yes',
                  onPress: () => {
                    setMeterNumber(anyNumber[0]);
                    Alert.alert('✅ Success', `Meter number ${anyNumber[0]} set!`);
                  },
                },
              ]
            );
          } else {
            Alert.alert(
              '❌ Not Found',
              'Could not find a meter number. Would you like to enter it manually?',
              [
                {
                  text: 'No',
                  style: 'cancel',
                },
                {
                  text: 'Yes',
                  onPress: () => promptManualEntry('meter'),
                },
              ]
            );
          }
        }
      } else {
        Alert.alert('❌ No Text', 'No text detected. Please enter manually.');
        promptManualEntry('meter');
      }
    } catch (error) {
      console.error('❌ Scan Error:', error);
      Alert.alert('❌ Error', 'Failed to scan. Please enter manually.');
      promptManualEntry('meter');
    } finally {
      setScanning(false);
      setOcrLoading(false);
    }
  }

  // =============================================
  // RECEIPT SCAN FUNCTIONS
  // =============================================

  async function handleReceiptCapture(image: any) {
    setScanning(true);
    setReceiptVisible(false);

    try {
      Alert.alert('Scanning', 'Reading receipt data...');

      const text = await performOCR(image.uri);
      console.log('📝 Receipt OCR:', text);

      if (text) {
        const amountMatch = text.match(/R\s?(\d+(?:\.\d{2})?)/i);
        const unitsMatch = text.match(/(\d+(?:\.\d+)?)\s*kWh/i);
        const tokenMatch = text.match(/\b(\d{20})\b/);

        let detectedUnits = '';
        let detectedAmount = '';
        let detectedToken = '';

        if (unitsMatch) {
          detectedUnits = unitsMatch[1];
          setUnits(detectedUnits);
        }

        if (amountMatch) {
          detectedAmount = amountMatch[1];
          setAmount(detectedAmount);
        }

        if (tokenMatch) {
          detectedToken = tokenMatch[1];
          setTokenCode(detectedToken);
        }

        let message = '📄 Receipt scanned!\n';
        if (detectedUnits) message += `Units: ${detectedUnits} kWh\n`;
        if (detectedAmount) message += `Amount: R${detectedAmount}\n`;
        if (detectedToken) message += `Token: ${detectedToken}`;

        if (detectedUnits || detectedAmount || detectedToken) {
          Alert.alert('✅ Success', message);
        } else {
          Alert.alert(
            '❌ No Data Found',
            'Could not extract data from receipt. Would you like to enter manually?',
            [
              {
                text: 'No',
                style: 'cancel',
              },
              {
                text: 'Yes',
                onPress: () => promptManualEntry('receipt'),
              },
            ]
          );
        }
      } else {
        Alert.alert('❌ No Text', 'Could not read the receipt. Please enter manually.');
        promptManualEntry('receipt');
      }
    } catch (error) {
      console.error('❌ Receipt Scan Error:', error);
      Alert.alert('❌ Error', 'Failed to scan receipt. Please enter manually.');
      promptManualEntry('receipt');
    } finally {
      setScanning(false);
      setOcrLoading(false);
    }
  }

  // =============================================
  // MANUAL ENTRY FALLBACK
  // =============================================

  function promptManualEntry(type: 'meter' | 'receipt') {
    if (type === 'meter') {
      Alert.prompt(
        'Enter Meter Number',
        'Please type your 11-digit meter number:',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'OK',
            onPress: (value?: string) => {
              if (value) {
                const cleaned = value.replace(/\D/g, '');
                if (cleaned.length >= 10) {
                  setMeterNumber(cleaned);
                }
              }
            },
          },
        ],
        'plain-text'
      );
    } else {
      Alert.prompt(
        'Enter Units',
        'How many kWh did you purchase?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Next',
            onPress: (unitsValue?: string) => {
              if (unitsValue) {
                const cleaned = unitsValue.replace(/\D/g, '');
                if (cleaned) {
                  setUnits(cleaned);
                  Alert.prompt(
                    'Enter Amount',
                    'How much did you pay (R)?',
                    [
                      {
                        text: 'Cancel',
                        style: 'cancel',
                      },
                      {
                        text: 'OK',
                        onPress: (amountValue?: string) => {
                          if (amountValue) {
                            const cleanedAmount = amountValue.replace(/[^0-9.]/g, '');
                            if (cleanedAmount) {
                              setAmount(cleanedAmount);
                            }
                          }
                        },
                      },
                    ],
                    'plain-text'
                  );
                }
              }
            },
          },
        ],
        'plain-text'
      );
    }
  }

  // =============================================
  // GALLERY FUNCTIONS
  // =============================================

  async function pickImageFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Gallery permission is required to select images');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setOcrLoading(true);
      await handleMeterCapture(result.assets[0]);
      setOcrLoading(false);
    }
  }

  async function pickReceiptFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Gallery permission is required to select images');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setOcrLoading(true);
      await handleReceiptCapture(result.assets[0]);
      setOcrLoading(false);
    }
  }

  // Balance calculation
  function calculateAccurateBalance() {
    if (!currentReading) {
      Alert.alert('Error', 'Please enter your current meter reading');
      return;
    }

    const reading = parseFloat(currentReading);
    setEstimatedBalance(reading);
    setShowReadingInput(false);
    setCurrentReading('');
    Alert.alert('Balance Updated', `Current estimated balance: ${reading.toFixed(2)} kWh`);
  }

  // ==================== SCREENS ====================

  // Camera Screen for Meter Scanning
  if (cameraVisible) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing="back"
        >
          <View style={{ flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end', padding: 20 }}>
            {ocrLoading && (
              <View style={{ padding: 10, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 10, marginBottom: 10 }}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={{ color: '#fff', textAlign: 'center', marginTop: 5 }}>Processing image...</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.cameraButton, ocrLoading && { opacity: 0.5 }]}
              onPress={takePhoto}
              disabled={ocrLoading}
            >
              <Text style={styles.cameraButtonText}>📷 Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cameraButton, { backgroundColor: '#6c757d' }, ocrLoading && { opacity: 0.5 }]}
              onPress={pickImageFromGallery}
              disabled={ocrLoading}
            >
              <Text style={styles.cameraButtonText}>🖼️ Choose from Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cameraButton, { backgroundColor: '#dc3545' }]}
              onPress={() => setCameraVisible(false)}
            >
              <Text style={styles.cameraButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    );
  }

  // Camera Screen for Receipt Scanning
  if (receiptVisible) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing="back"
        >
          <View style={{ flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end', padding: 20 }}>
            {ocrLoading && (
              <View style={{ padding: 10, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 10, marginBottom: 10 }}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={{ color: '#fff', textAlign: 'center', marginTop: 5 }}>Processing image...</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.cameraButton, ocrLoading && { opacity: 0.5 }]}
              onPress={takePhoto}
              disabled={ocrLoading}
            >
              <Text style={styles.cameraButtonText}>📷 Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cameraButton, { backgroundColor: '#6c757d' }, ocrLoading && { opacity: 0.5 }]}
              onPress={pickReceiptFromGallery}
              disabled={ocrLoading}
            >
              <Text style={styles.cameraButtonText}>🖼️ Choose from Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cameraButton, { backgroundColor: '#dc3545' }]}
              onPress={() => setReceiptVisible(false)}
            >
              <Text style={styles.cameraButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    );
  }

  // Login Screen
  if (currentScreen === 'login') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>⚡ Meter Tracker</Text>
        <Text style={styles.subtitle}>Track your prepaid electricity</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={theme.subtitle}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={theme.subtitle}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity style={styles.button} onPress={signIn} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Loading...' : 'Sign In'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setCurrentScreen('register')}>
          <Text style={styles.linkText}>Don't have an account? Sign Up</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleTheme} style={{ marginTop: 20 }}>
          <Text style={styles.linkText}>{isDarkMode ? '☀️ Switch to Light Mode' : '🌙 Switch to Dark Mode'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Register Screen
  if (currentScreen === 'register') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Create Account</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={theme.subtitle}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={theme.subtitle}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity style={styles.button} onPress={signUp} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Creating...' : 'Sign Up'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setCurrentScreen('login')}>
          <Text style={styles.linkText}>Back to Login</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleTheme} style={{ marginTop: 20 }}>
          <Text style={styles.linkText}>{isDarkMode ? '☀️ Switch to Light Mode' : '🌙 Switch to Dark Mode'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Dashboard Screen
  if (currentScreen === 'dashboard') {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Dashboard</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={toggleTheme} style={{ marginRight: 15 }}>
              <Text style={styles.linkText}>{isDarkMode ? '☀️' : '🌙'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={signOut}>
              <Text style={styles.linkText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {selectedMeter && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Current Meter</Text>
            <Text style={styles.cardText}>Meter Number: {selectedMeter.meter_number}</Text>
            <Text style={styles.cardText}>Municipality: {selectedMeter.municipality || 'Not set'}</Text>
            <Text style={styles.cardText}>Province: {selectedMeter.province || 'Not set'}</Text>
            <Text style={styles.balance}>Balance: {estimatedBalance.toFixed(2)} kWh</Text>
          </View>
        )}

        {!selectedMeter && registeredMeters.length === 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome!</Text>
            <Text style={styles.cardText}>Tap "Add Meter" to get started.</Text>
          </View>
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.smallButton} onPress={() => setCurrentScreen('addMeter')}>
            <Text style={styles.buttonText}>Add Meter</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.smallButton} onPress={() => setCurrentScreen('addPurchase')}>
            <Text style={styles.buttonText}>Add Purchase</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.smallButton} onPress={() => setCurrentScreen('history')}>
            <Text style={styles.buttonText}>History</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.smallButton, { backgroundColor: '#28a745' }]} onPress={() => setShowReadingInput(true)}>
            <Text style={styles.buttonText}>Update Balance</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.smallButton, { backgroundColor: '#6c757d' }]} onPress={() => setCurrentScreen('tidGuidance')}>
            <Text style={styles.buttonText}>TID Help</Text>
          </TouchableOpacity>
        </View>

        {registeredMeters.length > 1 && (
          <View>
            <Text style={styles.subtitle}>Switch Meter</Text>
            {registeredMeters.map((meter) => (
              <TouchableOpacity
                key={meter.id}
                style={styles.meterOption}
                onPress={() => {
                  setSelectedMeter(meter);
                  fetchPurchases(meter.id);
                }}
              >
                <Text style={styles.cardText}>{meter.meter_number} {selectedMeter?.id === meter.id && '✓'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.recentPurchases}>
          <Text style={styles.subtitle}>Recent Purchases</Text>
          {purchases.slice(0, 5).map((purchase) => (
            <View key={purchase.id} style={styles.purchaseItem}>
              <Text style={styles.cardText}>{new Date(purchase.purchase_date).toLocaleDateString()}</Text>
              <Text style={styles.cardText}>{purchase.units} kWh</Text>
              <Text style={{ color: '#28a745', fontWeight: 'bold' }}>R{purchase.amount}</Text>
            </View>
          ))}
          {purchases.length === 0 && (
            <Text style={styles.emptyText}>No purchases yet.</Text>
          )}
        </View>

        {/* Balance Update Modal */}
        <Modal visible={showReadingInput} transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Update Meter Reading</Text>
              <Text style={styles.modalSubtitle}>Enter your current meter reading (kWh)</Text>
              <TextInput
                style={styles.input}
                placeholder="Current reading"
                placeholderTextColor={theme.subtitle}
                keyboardType="numeric"
                value={currentReading}
                onChangeText={setCurrentReading}
              />
              <TouchableOpacity style={styles.button} onPress={calculateAccurateBalance}>
                <Text style={styles.buttonText}>Update Balance</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                setShowReadingInput(false);
                setCurrentReading('');
              }}>
                <Text style={styles.linkText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  }

  // Add Meter Screen
  if (currentScreen === 'addMeter') {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Add Meter</Text>

        <TouchableOpacity style={[styles.button, { backgroundColor: '#28a745' }]} onPress={scanMeterNumber}>
          <Text style={styles.buttonText}>📷 Scan Meter Number</Text>
        </TouchableOpacity>

        <Text style={[styles.cardText, { textAlign: 'center', marginVertical: 10 }]}>OR</Text>

        <TextInput
          style={styles.input}
          placeholder="Enter 11-digit meter number"
          placeholderTextColor={theme.subtitle}
          value={meterNumber}
          onChangeText={setMeterNumber}
          keyboardType="numeric"
          maxLength={11}
        />

        {/* Province Dropdown */}
        <View style={styles.dropdownContainer}>
          <Text style={[styles.label, { color: theme.text }]}>Select Province</Text>
          <View style={[styles.pickerWrapper, { borderColor: theme.inputBorder, backgroundColor: theme.pickerBackground }]}>
            <Picker
              selectedValue={selectedProvince}
              onValueChange={(itemValue) => handleProvinceSelect(itemValue)}
              style={[styles.picker, { color: theme.text }]}
              dropdownIconColor={theme.text}
              mode="dropdown"
            >
              <Picker.Item label="-- Select Province --" value="" />
              {provinces.map((province) => (
                <Picker.Item key={province.id} label={province.name} value={province.id} />
              ))}
            </Picker>
          </View>
        </View>

        {/* Municipality Dropdown */}
        {selectedProvince !== '' && (
          <View style={styles.dropdownContainer}>
            <Text style={[styles.label, { color: theme.text }]}>Select Municipality</Text>
            <View style={[styles.pickerWrapper, { borderColor: theme.inputBorder, backgroundColor: theme.pickerBackground }]}>
              <Picker
                selectedValue={selectedMunicipality}
                onValueChange={(itemValue) => setSelectedMunicipality(itemValue)}
                style={[styles.picker, { color: theme.text }]}
                dropdownIconColor={theme.text}
                mode="dropdown"
              >
                <Picker.Item label="-- Select Municipality --" value="" />
                {filteredMunicipalities.map((muni) => (
                  <Picker.Item key={muni} label={muni} value={muni} />
                ))}
              </Picker>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, { marginTop: 20 }]}
          onPress={addMeter}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Save Meter'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => {
          setCurrentScreen('dashboard');
          setMeterNumber('');
          setMunicipality('');
          setSelectedProvince('');
          setSelectedMunicipality('');
          setFilteredMunicipalities([]);
        }}>
          <Text style={styles.linkText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={toggleTheme} style={{ marginTop: 20 }}>
          <Text style={styles.linkText}>{isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Add Purchase Screen
  if (currentScreen === 'addPurchase') {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Add Purchase</Text>
        {selectedMeter && (
          <Text style={styles.subtitle}>Meter: {selectedMeter.meter_number}</Text>
        )}

        <TouchableOpacity style={[styles.button, { backgroundColor: '#28a745' }]} onPress={scanReceipt}>
          <Text style={styles.buttonText}>📷 Scan Receipt</Text>
        </TouchableOpacity>

        <Text style={[styles.cardText, { textAlign: 'center', marginVertical: 10 }]}>OR</Text>

        <TextInput
          style={styles.input}
          placeholder="Units purchased (kWh)"
          placeholderTextColor={theme.subtitle}
          value={units}
          onChangeText={setUnits}
          keyboardType="numeric"
        />
        <TextInput
          style={styles.input}
          placeholder="Amount paid (R)"
          placeholderTextColor={theme.subtitle}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
        />
        <TextInput
          style={styles.input}
          placeholder="Token code (optional)"
          placeholderTextColor={theme.subtitle}
          value={tokenCode}
          onChangeText={setTokenCode}
        />
        <TouchableOpacity style={styles.button} onPress={addPurchase} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Save Purchase'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {
          setCurrentScreen('dashboard');
          setUnits('');
          setAmount('');
          setTokenCode('');
        }}>
          <Text style={styles.linkText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // History Screen
  if (currentScreen === 'history') {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Purchase History</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={exportHistory} style={{ marginRight: 15 }}>
              <Text style={styles.linkText}>📤 Export</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCurrentScreen('dashboard')}>
              <Text style={styles.linkText}>Back</Text>
            </TouchableOpacity>
          </View>
        </View>
        {selectedMeter && (
          <Text style={styles.subtitle}>Meter: {selectedMeter.meter_number}</Text>
        )}
        {purchases.map((purchase) => (
          <View key={purchase.id} style={styles.historyItem}>
            <Text style={styles.historyDate}>{new Date(purchase.purchase_date).toLocaleString()}</Text>
            <Text style={styles.historyUnits}>Units: {purchase.units} kWh</Text>
            <Text style={styles.historyAmount}>Amount: R{purchase.amount}</Text>
            {purchase.token_code && (
              <Text style={styles.historyToken}>Token: {purchase.token_code}</Text>
            )}
          </View>
        ))}
        {purchases.length === 0 && (
          <Text style={styles.emptyText}>No purchases recorded yet.</Text>
        )}
        <TouchableOpacity onPress={toggleTheme} style={{ marginTop: 20 }}>
          <Text style={styles.linkText}>{isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // TID/KRN Guidance Screen
  if (currentScreen === 'tidGuidance') {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>TID / KRN Guidance</Text>
          <TouchableOpacity onPress={() => setCurrentScreen('dashboard')}>
            <Text style={styles.linkText}>Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What is KRN?</Text>
          <Text style={styles.cardText}>KRN stands for Key Revision Number. It tells you if your prepaid meter is up to date.</Text>
        </View>

        <View style={[styles.card, { backgroundColor: isDarkMode ? '#332211' : '#fff3cd' }]}>
          <Text style={styles.cardTitle}>⚠️ KRN1</Text>
          <Text style={styles.cardText}>Your meter is still on the old system. It needs to be updated.</Text>
          <Text style={{ marginTop: 10, fontWeight: 'bold', color: theme.text }}>What to do:</Text>
          <Text style={styles.cardText}>1. Buy at least 1 unit of electricity</Text>
          <Text style={styles.cardText}>2. Enter the token into your meter</Text>
          <Text style={styles.cardText}>3. The meter will update automatically</Text>
          <Text style={styles.cardText}>4. Your next receipt will show KRN2</Text>
        </View>

        <View style={[styles.card, { backgroundColor: isDarkMode ? '#113322' : '#d4edda' }]}>
          <Text style={styles.cardTitle}>✅ KRN2</Text>
          <Text style={styles.cardText}>Your meter is up to date. No action needed.</Text>
        </View>

        <View style={[styles.card, { backgroundColor: isDarkMode ? '#331111' : '#f8d7da' }]}>
          <Text style={styles.cardTitle}>📅 Important Deadline</Text>
          <Text style={styles.cardText}>All prepaid meters must be updated by November 24, 2024.</Text>
          <Text style={{ marginTop: 10, color: theme.text }}>After this date, KRN1 meters will not accept new tokens.</Text>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#dc3545' }]}
          onPress={() => Alert.alert('Need Help?', 'Contact your municipality or Eskom for assistance.')}
        >
          <Text style={styles.buttonText}>Get Help</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return null;
}

// =============================================
// STYLES FUNCTION
// =============================================

function getStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: theme.background },
    title: { fontSize: 28, fontWeight: 'bold', marginBottom: 5, textAlign: 'center', color: theme.text },
    subtitle: { fontSize: 16, color: theme.subtitle, marginBottom: 20, textAlign: 'center' },
    input: {
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 8,
      padding: 12,
      marginBottom: 15,
      fontSize: 16,
      backgroundColor: theme.input,
      color: theme.inputText,
    },
    button: { backgroundColor: theme.button, padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
    buttonText: { color: theme.buttonText, fontSize: 16, fontWeight: '600' },
    linkText: { color: '#007bff', textAlign: 'center', marginTop: 15 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    card: { backgroundColor: theme.card, padding: 15, borderRadius: 12, marginBottom: 20 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: theme.cardText },
    cardText: { color: theme.cardText },
    balance: { fontSize: 20, fontWeight: 'bold', color: '#28a745', marginTop: 10 },
    buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, gap: 10 },
    smallButton: { backgroundColor: theme.smallButton, padding: 12, borderRadius: 8, flex: 1, alignItems: 'center' },
    meterOption: { padding: 12, backgroundColor: theme.card, borderRadius: 8, marginBottom: 8 },
    recentPurchases: { marginTop: 10, marginBottom: 30 },
    purchaseItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
    historyItem: { backgroundColor: theme.card, padding: 15, borderRadius: 8, marginBottom: 10 },
    historyDate: { fontSize: 14, color: theme.subtitle, marginBottom: 5 },
    historyUnits: { fontSize: 16, fontWeight: '600', color: theme.text },
    historyAmount: { fontSize: 16, color: '#28a745' },
    historyToken: { fontSize: 12, color: theme.subtitle, marginTop: 5 },
    emptyText: { textAlign: 'center', marginTop: 30, color: theme.subtitle },
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.modalOverlay },
    modalContent: { backgroundColor: theme.modalContent, padding: 25, borderRadius: 12, width: '85%' },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', color: theme.text },
    modalSubtitle: { fontSize: 14, color: theme.subtitle, marginBottom: 20, textAlign: 'center' },
    // Camera button styles
    cameraButton: {
      backgroundColor: '#28a745',
      padding: 15,
      borderRadius: 10,
      alignItems: 'center',
      marginBottom: 10,
    },
    cameraButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '600',
    },
    // Province & Municipality dropdown styles
    dropdownContainer: {
      marginBottom: 15,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 5,
    },
    pickerWrapper: {
      borderWidth: 1,
      borderRadius: 8,
      overflow: 'hidden',
    },
    picker: {
      height: 50,
      width: '100%',
    },
  });
}