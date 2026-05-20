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
 * ③ 제철음식 중형 위젯 (4×2)
 * - 제철음식 3개 (매일 3개씩 순환)
 */
public class SeasonalMediumWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int widgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, widgetId);
        }
    }

    static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_seasonal_medium);

        List<WidgetDataHelper.SeasonalItem> items = WidgetDataHelper.getRotatedIngredients(context, 3);
        int total = WidgetDataHelper.getThisMonthIngredients(context).size();

        views.setTextViewText(R.id.tv_month_label, WidgetDataHelper.getCurrentMonthLabel() + " 제철음식");
        views.setTextViewText(R.id.tv_count, "총 " + total + "종");

        // 행 ID 배열
        int[] emojiIds   = {R.id.tv_emoji1,    R.id.tv_emoji2,    R.id.tv_emoji3};
        int[] nameIds    = {R.id.tv_name1,     R.id.tv_name2,     R.id.tv_name3};
        int[] catIds     = {R.id.tv_category1, R.id.tv_category2, R.id.tv_category3};
        int[] rowIds     = {R.id.row1,         R.id.row2,         R.id.row3};

        for (int i = 0; i < 3; i++) {
            if (i < items.size()) {
                WidgetDataHelper.SeasonalItem item = items.get(i);
                views.setViewVisibility(rowIds[i], View.VISIBLE);
                views.setTextViewText(emojiIds[i], item.emoji);
                views.setTextViewText(nameIds[i], item.name);
                views.setTextViewText(catIds[i], item.category);
            } else {
                views.setViewVisibility(rowIds[i], View.GONE);
            }
        }

        views.setOnClickPendingIntent(android.R.id.content, getLaunchIntent(context));
        manager.updateAppWidget(widgetId, views);
    }

    static PendingIntent getLaunchIntent(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        return PendingIntent.getActivity(context, 2, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
