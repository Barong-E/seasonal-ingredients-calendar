import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { addNotificationHistory } from './notification-history.js';

function inferTypeFromData(data = {}) {
  if (data.type) return data.type;
  const url = data.url || '';
  if (url.includes('holiday')) return 'holiday';
  if (url.includes('index') || url.includes('month')) return 'ingredient';
  return 'general';
}

function rememberNotification(title, body, data = {}) {
  try {
    addNotificationHistory({
      title: title || '띵동 제철음식',
      body: body || '',
      type: inferTypeFromData(data),
      url: data.url || ''
    });
  } catch (e) {
    console.warn('알림 히스토리 저장 실패:', e);
  }
}

export async function initPush() {
  if (!Capacitor.isNativePlatform()) {
    console.log('웹 환경이므로 Push 알림 초기화를 건너뜁니다.');
    return;
  }

  console.log('Push 알림 초기화 시작...');

  try {
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.log('Push 권한이 거부되었습니다.');
      return;
    }

    await PushNotifications.register();

    PushNotifications.addListener('registration', (token) => {
      console.log('Push Registration Token:', token.value);
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('Push 등록 실패:', error);
    });

    PushNotifications.addListener('pushNotificationReceived', async (notification) => {
      console.log('알림 수신:', notification);
      rememberNotification(notification.title, notification.body, notification.data || {});

      await LocalNotifications.schedule({
        notifications: [{
          title: notification.title || '띵동 제철음식',
          body: notification.body || '새로운 알림이 도착했습니다.',
          id: new Date().getTime(),
          schedule: { at: new Date(Date.now() + 100) },
          extra: notification.data,
          channelId: 'default',
          smallIcon: 'ic_notification'
        }]
      });
    });

    const handleNotificationAction = (notification) => {
      console.log('알림 액션 발생:', notification);
      const data = notification.notification.extra || notification.notification.data || {};
      rememberNotification(
        notification.notification.title,
        notification.notification.body,
        data
      );

      if (data && data.url) {
        window.location.href = data.url;
      } else if (data && data.path) {
        window.location.hash = data.path;
      }
    };

    PushNotifications.addListener('pushNotificationActionPerformed', handleNotificationAction);
    LocalNotifications.addListener('localNotificationActionPerformed', handleNotificationAction);

    await PushNotifications.createChannel({
      id: 'default',
      name: '기본 알림',
      description: '띵동 제철음식 기본 알림',
      importance: 3,
      visibility: 1
    });

    console.log('Push 알림 설정 완료');
  } catch (e) {
    console.error('Push 초기화 중 오류 발생:', e);
  }
}
