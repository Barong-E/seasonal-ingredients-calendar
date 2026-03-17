import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

export async function initPush() {
  if (!Capacitor.isNativePlatform()) {
    console.log('웹 환경이므로 Push 알림 초기화를 건너뜁니다.');
    return;
  }

  console.log('Push 알림 초기화 시작...');

  try {
    // 1. 권한 확인 및 요청
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.log('Push 권한이 거부되었습니다.');
      return;
    }

    // 2. FCM 등록 (토큰 발급)
    await PushNotifications.register();

    // 3. 리스너 등록
    
    // 토큰 발급 성공 시
    PushNotifications.addListener('registration', (token) => {
      console.log('Push Registration Token:', token.value);
      // 개발 단계에서는 토큰을 쉽게 알 수 있도록 콘솔에 띄움
    });

    // 토큰 발급 실패 시
    PushNotifications.addListener('registrationError', (error) => {
      console.error('Push 등록 실패:', error);
    });

    // 앱 실행 중 알림 수신 시
    PushNotifications.addListener('pushNotificationReceived', async (notification) => {
      console.log('알림 수신:', notification);
      
      // 포그라운드에서도 상단 배너 알림을 띄우기 위해 LocalNotification 사용
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

    // 알림 클릭 공통 처리 로직
    const handleNotificationAction = (notification) => {
      console.log('알림 액션 발생:', notification);
      const data = notification.notification.extra || notification.notification.data;
      
      if (data && data.url) {
        // 절대 경로 이동 (예: holiday.html?id=hansik)
        window.location.href = data.url;
      } else if (data && data.path) {
        // 해시 이동 (#galchi-jorim 등)
        window.location.hash = data.path;
      }
    };

    // 푸시 알림 클릭 시 액션
    PushNotifications.addListener('pushNotificationActionPerformed', handleNotificationAction);

    // 로컬 알림 클릭 시 액션 (사용자가 설정한 제철/명절 알림용)
    LocalNotifications.addListener('localNotificationActionPerformed', handleNotificationAction);

    // 4. 안드로이드 알림 채널 생성
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
