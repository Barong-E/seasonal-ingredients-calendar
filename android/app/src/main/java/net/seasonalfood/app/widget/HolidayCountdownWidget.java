package net.seasonalfood.app.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import net.seasonalfood.app.MainActivity;
import net.seasonalfood.app.R;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * ⑥ 명절 카운트다운 위젯 (2×2)
 * - D-Day 숫자를 매우 크게 표시하는 정사각형 위젯
 */
public class HolidayCountdownWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int widgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, widgetId);
        }
    }

    static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_holiday_countdown);

        WidgetDataHelper.HolidayItem holiday = WidgetDataHelper.getNextHoliday(context);

        if (holiday != null) {
            views.setTextViewText(R.id.tv_holiday_name, "🎋 " + holiday.name);
            if (holiday.dDay == 0) {
                views.setTextViewText(R.id.tv_dday_number, "🎉");
                views.setTextViewText(R.id.tv_holiday_date, "오늘이에요!");
            } else {
                views.setTextViewText(R.id.tv_dday_number, String.valueOf(holiday.dDay));
                views.setTextViewText(R.id.tv_holiday_date, holiday.dDay + "일 후");
            }
        } else {
            views.setTextViewText(R.id.tv_holiday_name, "🎋 명절");
            views.setTextViewText(R.id.tv_dday_number, "?");
            views.setTextViewText(R.id.tv_holiday_date, "앱 확인");
        }

        views.setOnClickPendingIntent(android.R.id.content, getLaunchIntent(context));
        manager.updateAppWidget(widgetId, views);
    }

    static PendingIntent getLaunchIntent(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        return PendingIntent.getActivity(context, 5, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
