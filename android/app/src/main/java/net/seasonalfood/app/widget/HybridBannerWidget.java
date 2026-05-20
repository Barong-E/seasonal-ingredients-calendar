package net.seasonalfood.app.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import net.seasonalfood.app.MainActivity;
import net.seasonalfood.app.R;

import java.util.List;

/**
 * ⑧ 하이브리드 배너 위젯 (4×1)
 * - 제철음식 1개(순환) + 명절 D-Day
 */
public class HybridBannerWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int widgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, widgetId);
        }
    }

    static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_hybrid_banner);

        // 제철음식
        List<WidgetDataHelper.SeasonalItem> items = WidgetDataHelper.getRotatedIngredients(context, 1);
        if (!items.isEmpty()) {
            views.setTextViewText(R.id.tv_seasonal_emoji, items.get(0).emoji);
            views.setTextViewText(R.id.tv_seasonal_name, items.get(0).name);
        } else {
            views.setTextViewText(R.id.tv_seasonal_emoji, "🌿");
            views.setTextViewText(R.id.tv_seasonal_name, "제철음식");
        }

        // 명절
        WidgetDataHelper.HolidayItem holiday = WidgetDataHelper.getNextHoliday(context);
        if (holiday != null) {
            views.setTextViewText(R.id.tv_holiday_name, holiday.name);
            views.setTextViewText(R.id.tv_dday, holiday.dDayText);
        } else {
            views.setTextViewText(R.id.tv_holiday_name, "명절");
            views.setTextViewText(R.id.tv_dday, "-");
        }

        views.setOnClickPendingIntent(android.R.id.content, getLaunchIntent(context));
        manager.updateAppWidget(widgetId, views);
    }

    static PendingIntent getLaunchIntent(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        return PendingIntent.getActivity(context, 7, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
