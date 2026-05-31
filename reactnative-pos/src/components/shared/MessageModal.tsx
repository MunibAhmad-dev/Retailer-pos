import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Animated,
  Linking,
  Share,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MessageTemplateType = 'balance' | 'payment' | 'reminder' | 'custom';

interface Recipient {
  name: string;
  phone: string;
}

interface MessageModalProps {
  visible: boolean;
  onClose: () => void;
  recipient: Recipient;
  type: 'customer' | 'vendor';
  amount?: number;
  templateType?: MessageTemplateType;
}

// ─── Templates ────────────────────────────────────────────────────────────────

function buildTemplate(
  templateType: MessageTemplateType,
  recipient: Recipient,
  type: 'customer' | 'vendor',
  amount: number,
): { urdu: string; english: string } {
  const amountStr = `Rs ${amount.toLocaleString()}`;

  if (templateType === 'balance') {
    return {
      urdu: `السلام علیکم ${recipient.name} جی،\nآپ کا بقایا ${amountStr} ہے۔ براہ کرم جلد ادا کریں۔\nشکریہ\nOsaTech POS`,
      english: `Dear ${recipient.name},\nYour outstanding balance is ${amountStr}. Please clear it at your earliest convenience.\nThank you\nOsaTech POS`,
    };
  }
  if (templateType === 'payment') {
    return {
      urdu: `السلام علیکم ${recipient.name} جی،\nآپ کی ${amountStr} کی ادائیگی موصول ہو گئی۔ جزاک اللہ\nOsaTech POS`,
      english: `Dear ${recipient.name},\nYour payment of ${amountStr} has been received. Thank you!\nOsaTech POS`,
    };
  }
  if (templateType === 'reminder') {
    return {
      urdu: `یاد دہانی: ${recipient.name} جی، آپ کا واجب الادا ${amountStr} ہے۔ مہربانی فرما کر ادا کریں۔\nOsaTech POS`,
      english: `Reminder: Dear ${recipient.name}, your payment of ${amountStr} is due. Kindly settle at your earliest.\nOsaTech POS`,
    };
  }
  // custom — empty editable
  return { urdu: '', english: '' };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MessageModal({
  visible,
  onClose,
  recipient,
  type,
  amount = 0,
  templateType = 'balance',
}: MessageModalProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const slideAnim = useRef(new Animated.Value(600)).current;
  const { height: SCREEN_H } = Dimensions.get('window');

  const [lang, setLang] = useState<'urdu' | 'english'>('urdu');
  const [customAmount, setCustomAmount] = useState(String(amount));
  const [editableText, setEditableText] = useState('');

  const parsed = parseFloat(customAmount) || 0;
  const templates = buildTemplate(templateType, recipient, type, parsed);
  const messageText = lang === 'urdu' ? templates.urdu : templates.english;

  // Use editable text when templateType === 'custom'
  const finalText =
    templateType === 'custom' ? editableText : messageText;

  useEffect(() => {
    if (visible) {
      setCustomAmount(String(amount));
      setEditableText('');
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 12,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 600,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, amount]);

  const handleWhatsApp = () => {
    const phone = recipient.phone.replace(/\D/g, '');
    const e164 = phone.startsWith('92') ? phone : `92${phone.slice(-10)}`;
    const url = `whatsapp://send?phone=+${e164}&text=${encodeURIComponent(finalText)}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(
        `https://wa.me/+${e164}?text=${encodeURIComponent(finalText)}`,
      );
    });
    onClose();
  };

  const handleSMS = () => {
    Linking.openURL(
      `sms:${recipient.phone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(finalText)}`,
    );
    onClose();
  };

  const handleCopy = async () => {
    await Share.share({ message: finalText });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
        activeOpacity={1}
        onPress={onClose}
      />

      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.elevated,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            transform: [{ translateY: slideAnim }],
            maxHeight: SCREEN_H * 0.85,
          },
        ]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Handle bar */}
            <View style={styles.handleWrap}>
              <View
                style={[styles.handle, { backgroundColor: colors.border }]}
              />
            </View>

            <View style={{ paddingHorizontal: spacing[4], paddingBottom: spacing[6] }}>
              {/* Header */}
              <View style={[styles.row, { marginBottom: spacing[4] }]}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: typography.sizes.lg,
                      fontWeight: typography.weights.bold,
                    }}
                  >
                    Send Message
                  </Text>
                  <Text
                    style={{
                      color: colors.textSub,
                      fontSize: typography.sizes.sm,
                      marginTop: 2,
                    }}
                  >
                    {recipient.name} · {recipient.phone}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Text style={{ color: colors.textSub, fontSize: 18 }}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Amount input (when not custom template) */}
              {templateType !== 'custom' && (
                <View style={{ marginBottom: spacing[3] }}>
                  <Text
                    style={{
                      color: colors.textSub,
                      fontSize: typography.sizes.sm,
                      marginBottom: spacing[1],
                    }}
                  >
                    Amount (Rs)
                  </Text>
                  <TextInput
                    value={customAmount}
                    onChangeText={setCustomAmount}
                    keyboardType="numeric"
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        color: colors.text,
                        borderRadius: radius.md,
                        fontSize: typography.sizes.base,
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[3],
                      },
                    ]}
                    placeholderTextColor={colors.textMuted}
                    placeholder="0"
                  />
                </View>
              )}

              {/* Language toggle */}
              {templateType !== 'custom' && (
                <View style={[styles.langToggle, { marginBottom: spacing[3] }]}>
                  {(['urdu', 'english'] as const).map((l) => (
                    <TouchableOpacity
                      key={l}
                      onPress={() => setLang(l)}
                      style={[
                        styles.langBtn,
                        {
                          backgroundColor:
                            lang === l ? colors.primary : colors.surface,
                          borderRadius: radius.sm,
                          flex: 1,
                          paddingVertical: spacing[2],
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: lang === l ? colors.primaryFg : colors.textSub,
                          fontSize: typography.sizes.sm,
                          fontWeight: typography.weights.semibold,
                          textAlign: 'center',
                        }}
                      >
                        {l === 'urdu' ? 'اردو' : 'English'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Preview / edit */}
              <View style={{ marginBottom: spacing[4] }}>
                <Text
                  style={{
                    color: colors.textSub,
                    fontSize: typography.sizes.sm,
                    marginBottom: spacing[1],
                  }}
                >
                  {templateType === 'custom' ? 'Message' : 'Preview'}
                </Text>
                <TextInput
                  value={templateType === 'custom' ? editableText : finalText}
                  onChangeText={
                    templateType === 'custom' ? setEditableText : undefined
                  }
                  editable={templateType === 'custom'}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  style={[
                    {
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.md,
                      color: colors.text,
                      fontSize: typography.sizes.sm,
                      padding: spacing[3],
                      minHeight: 110,
                      lineHeight: 22,
                    },
                    lang === 'urdu' && templateType !== 'custom'
                      ? { textAlign: 'right', writingDirection: 'rtl' }
                      : {},
                  ]}
                  placeholderTextColor={colors.textMuted}
                  placeholder="Type your message..."
                />
              </View>

              {/* Action buttons */}
              <TouchableOpacity
                onPress={handleWhatsApp}
                style={[
                  styles.actionBtn,
                  { backgroundColor: '#25D366', borderRadius: radius.md },
                ]}
              >
                <Text style={[styles.actionBtnText, { color: '#ffffff' }]}>
                  Send on WhatsApp
                </Text>
              </TouchableOpacity>

              <View style={[styles.row, { gap: spacing[3], marginTop: spacing[3] }]}>
                <TouchableOpacity
                  onPress={handleSMS}
                  style={[
                    styles.actionBtn,
                    {
                      flex: 1,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.md,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.actionBtnText,
                      { color: colors.text },
                    ]}
                  >
                    Send SMS
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleCopy}
                  style={[
                    styles.actionBtn,
                    {
                      flex: 1,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.md,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.actionBtnText,
                      { color: colors.text },
                    ]}
                  >
                    Copy Text
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeBtn: {
    padding: 8,
  },
  input: {
    borderWidth: 1,
  },
  langToggle: {
    flexDirection: 'row',
    gap: 8,
    padding: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  langBtn: {
    alignItems: 'center',
  },
  actionBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default MessageModal;
