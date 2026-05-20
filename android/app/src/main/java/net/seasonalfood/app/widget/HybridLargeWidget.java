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
 * ⑩ 하이브리드 대형 위젯 (4×4)
 * - 제철음식 5개(순환) + 명절 이름 + 대표음식 + D-Day
 */
public class HybridLargeWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int widgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, widgetId);
        }
    }

    static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_hybrid_large);

        // 제철음식 5개
        List<WidgetDataHelper.SeasonalItem> items = WidgetDataHelper.getRotatedIngredients(context, 5);
        int total = WidgetDataHelper.getThisMonthIngredients(context).size();

        views.setTextViewText(R.id.tv_month_label, WidgetDataHelper.getCurrentMonthLabel() + " 제철음식");
        views.setTextViewText(R.id.tv_count, "총 " + total + "종");

        int[] emojiIds = {R.id.tv_emoji1, R.id.tv_emoji2, R.id.tv_emoji3, R.id.tv_emoji4, R.id.tv_emoji5};
        int[] nameIds  = {R.id.tv_name1,  R.id.tv_name2,  R.id.tv_name3,  R.id.tv_name4,  R.id.tv_name5};
        int[] catIds   = {R.id.tv_cat1,   R.id.tv_cat2,   R.id.tv_cat3,   R.id.tv_cat4,   R.id.tv_cat5};
        int[] rowIds   = {R.id.row1,      R.id.row2,      R.id.row3,      R.id.row4,      R.id.row5};

        for (int i = 0; i < 5; i++) {
            if (i < items.size()) {
                views.setViewVisibility(rowIds[i], View.VISIBLE);
                views.setTextViewText(emojiIds[i], items.get(i).emoji);
                views.setTextViewText(nameIds[i],  items.get(i).name);
                views.setTextViewText(catIds[i],   items.get(i).category);
            } else {
                views.setViewVisibility(rowIds[i], View.GONE);
            }
        }

        // 명절
        WidgetDataHelper.HolidayItem holiday = WidgetDataHelper.getNextHoliday(context);
        if (holiday != null) {
            views.setTextViewText(R.id.tv_holiday_name, holiday.name);
            views.setTextViewText(R.id.tv_main_food,
                    holiday.mainFood.isEmpty() ? "-" : holiday.mainFood);
            views.setTextViewText(R.id.tv_dday, holiday.dDayText);
        } else {
            views.setTextViewText(R.id.tv_holiday_name, "명절 정보 없음");
            views.setTextViewText(R.id.tv_main_food, "앱을 열어보세요");
            views.setTextViewText(R.id.tv_dday, "");
        }

        views.setOnClickPendingIntent(android.R.id.content, getLaunchIntent(context));
        manager.updateAppWidget(widgetId, views);
    }

    static PendingIntent getLaunchIntent(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        return PendingIntent.getActivity(context, 9, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
