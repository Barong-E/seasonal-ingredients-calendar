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
 * ⑤ 명절 미니 위젯 (2×1)
 * - 가장 가까운 명절 이름 + D-Day
 */
public class HolidayMiniWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int widgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, widgetId);
        }
    }

    static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_holiday_mini);

        WidgetDataHelper.HolidayItem holiday = WidgetDataHelper.getNextHoliday(context);

        if (holiday != null) {
            views.setTextViewText(R.id.tv_holiday_name, holiday.emoji + " " + holiday.name);
            views.setTextViewText(R.id.tv_main_food, "대표: " + holiday.mainFood);
            views.setTextViewText(R.id.tv_dday, holiday.dDayText);
        } else {
            views.setTextViewText(R.id.tv_holiday_name, "🎋 명절 정보");
            views.setTextViewText(R.id.tv_main_food, "앱을 열어 확인하세요");
            views.setTextViewText(R.id.tv_dday, "D-Day");
        }

        views.setOnClickPendingIntent(android.R.id.content, getLaunchIntent(context));
        manager.updateAppWidget(widgetId, views);
    }

    static PendingIntent getLaunchIntent(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        return PendingIntent.getActivity(context, 4, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
