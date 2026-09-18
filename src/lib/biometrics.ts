import * as LocalAuthentication from "expo-local-authentication";

export type BiometricSupport = {
  hasHardware: boolean;
  isEnrolled: boolean;
  canUse: boolean;
};

export async function checkBiometricSupport(): Promise<BiometricSupport> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return {
    hasHardware,
    isEnrolled,
    canUse: hasHardware && isEnrolled,
  };
}

export async function authenticate(reason: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    disableDeviceFallback: false,
    cancelLabel: "Cancelar",
  });
  return result.success;
}
