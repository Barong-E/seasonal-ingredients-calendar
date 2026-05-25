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
 * ⑤ 하이브리드 스퀘어 위젯 (2×2)
 * - 상단: 오늘의 추천 제철음식 (이모지 + 이름)
 * - 하단: 다가오는 명절 D-Day 정보
 */
public class HybridSquareWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int widgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, widgetId);
        }
    }

    static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_hybrid_square);

        // 1. 제철음식 로드 (1개)
        List<WidgetDataHelper.SeasonalItem> seasonalItems = WidgetDataHelper.getRotatedIngredients(context, 1);
        if (!seasonalItems.isEmpty()) {
            WidgetDataHelper.SeasonalItem item = seasonalItems.get(0);
            views.setTextViewText(R.id.tv_seasonal_emoji, item.emoji);
            views.setTextViewText(R.id.tv_seasonal_name, item.name);
        } else {
            views.setTextViewText(R.id.tv_seasonal_emoji, "🌿");
            views.setTextViewText(R.id.tv_seasonal_name, "제철음식");
        }

        // 2. 명절 D-Day 로드
        WidgetDataHelper.HolidayItem holiday = WidgetDataHelper.getNextHoliday(context);
        if (holiday != null) {
            views.setTextViewText(R.id.tv_holiday_name, holiday.name + " " + holiday.emoji);
            views.setTextViewText(R.id.tv_holiday_dday, holiday.dDayText);
        } else {
            views.setTextViewText(R.id.tv_holiday_name, "다가오는 명절");
            views.setTextViewText(R.id.tv_holiday_dday, "D-Day");
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
