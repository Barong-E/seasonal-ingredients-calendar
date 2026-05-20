package net.seasonalfood.app.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;

import net.seasonalfood.app.MainActivity;
import net.seasonalfood.app.R;

import java.util.List;

/**
 * ⑨ 하이브리드 중형 위젯 (4×2)
 * - 제철음식 2개(순환) + 명절 이름 + D-Day
 */
public class HybridMediumWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int widgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, widgetId);
        }
    }

    static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_hybrid_medium);

        // 제철음식 2개
        List<WidgetDataHelper.SeasonalItem> items = WidgetDataHelper.getRotatedIngredients(context, 2);
        views.setTextViewText(R.id.tv_month_label, WidgetDataHelper.getCurrentMonthLabel() + " 제철");

        int[] emojiIds = {R.id.tv_emoji1, R.id.tv_emoji2};
        int[] nameIds  = {R.id.tv_name1,  R.id.tv_name2};
        int[] catIds   = {R.id.tv_cat1,   R.id.tv_cat2};
        int[] rowIds   = {R.id.row1,      R.id.row2};

        for (int i = 0; i < 2; i++) {
            if (i < items.size()) {
                views.setViewVisibility(rowIds[i], View.VISIBLE);
                views.setTextViewText(emojiIds[i], items.get(i).emoji);
                views.setTextViewText(nameIds[i], items.get(i).name);
                views.setTextViewText(catIds[i], items.get(i).category);
            } else {
                views.setViewVisibility(rowIds[i], View.GONE);
            }
        }

        // 명절
        WidgetDataHelper.HolidayItem holiday = WidgetDataHelper.getNextHoliday(context);
        if (holiday != null) {
            views.setTextViewText(R.id.tv_holiday_name, holiday.name);
            views.setTextViewText(R.id.tv_dday, holiday.dDayText);
        } else {
            views.setTextViewText(R.id.tv_holiday_name, "명절 정보");
            views.setTextViewText(R.id.tv_dday, "-");
        }

        views.setOnClickPendingIntent(android.R.id.content, getLaunchIntent(context));
        manager.updateAppWidget(widgetId, views);
    }

    static PendingIntent getLaunchIntent(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        return PendingIntent.getActivity(context, 8, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
