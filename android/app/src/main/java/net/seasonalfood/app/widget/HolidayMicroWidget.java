package net.seasonalfood.app.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import net.seasonalfood.app.MainActivity;
import net.seasonalfood.app.R;

/**
 * ② 명절 마이크로 위젯 (1×1)
 * - 명절 이모지와 D-Day 표시
 */
public class HolidayMicroWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int widgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, widgetId);
        }
    }

    static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_holiday_micro);

        // 데이터 가져오기
        WidgetDataHelper.HolidayItem holiday = WidgetDataHelper.getNextHoliday(context);

        if (holiday != null) {
            views.setTextViewText(R.id.tv_emoji, holiday.emoji);
            views.setTextViewText(R.id.tv_dday, holiday.dDayText);
        } else {
            views.setTextViewText(R.id.tv_emoji, "🎋");
            views.setTextViewText(R.id.tv_dday, "D-Day");
        }

        // 터치 시 앱 실행
        views.setOnClickPendingIntent(android.R.id.content, getLaunchIntent(context));

        manager.updateAppWidget(widgetId, views);
    }

    static PendingIntent getLaunchIntent(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        return PendingIntent.getActivity(context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
