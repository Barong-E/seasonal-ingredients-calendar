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
 * ⑦ 하이브리드 대시보드 위젯 (4×2)
 * - 좌측: 명절 D-Day 카운트다운 크게 배치
 * - 우측: 이번 달 추천 제철음식 3가지를 리스트 형태로 나열
 */
public class HybridDashboardWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int widgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, widgetId);
        }
    }

    static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_hybrid_dashboard);

        // 1. 명절 D-Day 로드
        WidgetDataHelper.HolidayItem holiday = WidgetDataHelper.getNextHoliday(context);
        if (holiday != null) {
            views.setTextViewText(R.id.tv_holiday_name, holiday.name + " " + holiday.emoji);
            views.setTextViewText(R.id.tv_holiday_dday, holiday.dDayText);
        } else {
            views.setTextViewText(R.id.tv_holiday_name, "다가오는 명절");
            views.setTextViewText(R.id.tv_holiday_dday, "D-Day");
        }

        // 2. 이번 달 제철음식 리스트 로드 (3개)
        views.setTextViewText(R.id.tv_list_title, WidgetDataHelper.getCurrentMonthLabel() + " 추천 제철");
        List<WidgetDataHelper.SeasonalItem> items = WidgetDataHelper.getRotatedIngredients(context, 3);

        if (items.size() >= 1) {
            views.setTextViewText(R.id.tv_item1_emoji, items.get(0).emoji);
            views.setTextViewText(R.id.tv_item1_name, items.get(0).name);
        } else {
            views.setTextViewText(R.id.tv_item1_emoji, "🌿");
            views.setTextViewText(R.id.tv_item1_name, "제철음식 1");
        }

        if (items.size() >= 2) {
            views.setTextViewText(R.id.tv_item2_emoji, items.get(1).emoji);
            views.setTextViewText(R.id.tv_item2_name, items.get(1).name);
        } else {
            views.setTextViewText(R.id.tv_item2_emoji, "🌿");
            views.setTextViewText(R.id.tv_item2_name, "제철음식 2");
        }

        if (items.size() >= 3) {
            views.setTextViewText(R.id.tv_item3_emoji, items.get(2).emoji);
            views.setTextViewText(R.id.tv_item3_name, items.get(2).name);
        } else {
            views.setTextViewText(R.id.tv_item3_emoji, "🌿");
            views.setTextViewText(R.id.tv_item3_name, "제철음식 3");
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
