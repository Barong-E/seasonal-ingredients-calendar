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
 * ⑦ 명절 중형 위젯 (4×2)
 * - 명절 이름 + D-Day + 대표음식
 */
public class HolidayMediumWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int widgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, widgetId);
        }
    }

    static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_holiday_medium);

        WidgetDataHelper.HolidayItem holiday = WidgetDataHelper.getNextHoliday(context);

        if (holiday != null) {
            views.setTextViewText(R.id.tv_holiday_name, holiday.name);
            views.setTextViewText(R.id.tv_dday, holiday.dDayText);
            views.setTextViewText(R.id.tv_main_food,
                    holiday.mainFood.isEmpty() ? "-" : holiday.mainFood);
        } else {
            views.setTextViewText(R.id.tv_holiday_name, "명절 정보 없음");
            views.setTextViewText(R.id.tv_dday, "");
            views.setTextViewText(R.id.tv_main_food, "앱을 열어보세요");
        }

        views.setOnClickPendingIntent(android.R.id.content, getLaunchIntent(context));
        manager.updateAppWidget(widgetId, views);
    }

    static PendingIntent getLaunchIntent(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        return PendingIntent.getActivity(context, 6, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
