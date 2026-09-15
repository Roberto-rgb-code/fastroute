import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Alert } from 'react-native';

/** Convierte el resultado del picker en un data URL base64 para enviar al API. */
function toDataUrl(asset: ImagePicker.ImagePickerAsset): string | null {
  if (!asset.base64) return null;
  const mime = asset.mimeType ?? 'image/jpeg';
  return `data:${mime};base64,${asset.base64}`;
}

/** Toma una foto con la cámara. Devuelve un data URL o null si se cancela. */
export async function capturePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permiso requerido', 'Habilita la cámara para tomar evidencia.');
    return null;
  }
  const res = await ImagePicker.launchCameraAsync({
    base64: true,
    quality: 0.5,
    allowsEditing: false,
  });
  if (res.canceled || !res.assets?.length) return null;
  return toDataUrl(res.assets[0]);
}

/** Selecciona una imagen de la galería. Devuelve un data URL o null. */
export async function pickFromLibrary(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permiso requerido', 'Habilita la galería para adjuntar imágenes.');
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    base64: true,
    quality: 0.5,
    allowsEditing: false,
  });
  if (res.canceled || !res.assets?.length) return null;
  return toDataUrl(res.assets[0]);
}

/** Pregunta cámara o galería y devuelve el data URL elegido. */
export function chooseImage(): Promise<string | null> {
  return new Promise((resolve) => {
    Alert.alert('Agregar imagen', '¿De dónde?', [
      { text: 'Cámara', onPress: () => capturePhoto().then(resolve) },
      { text: 'Galería', onPress: () => pickFromLibrary().then(resolve) },
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}

/** Ubicación actual (silenciosa). Devuelve {} si no hay permiso. */
export async function currentCoords(): Promise<{ lat?: number; lng?: number }> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return {};
    const pos = await Location.getCurrentPositionAsync({});
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return {};
  }
}
