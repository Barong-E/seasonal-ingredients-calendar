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
 * ① 제철음식 미니 위젯 (2×1)
 * - 이번 달 제철음식 1개 (매일 순환)
 */
public class SeasonalMiniWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int widgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, widgetId);
        }
    }

    static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_seasonal_mini);

        // 데이터 가져오기 (1개)
        List<WidgetDataHelper.SeasonalItem> items = WidgetDataHelper.getRotatedIngredients(context, 1);

        if (!items.isEmpty()) {
            WidgetDataHelper.SeasonalItem item = items.get(0);
            views.setTextViewText(R.id.tv_month_label, WidgetDataHelper.getCurrentMonthLabel() + " 제철");
            views.setTextViewText(R.id.tv_emoji, item.emoji);
            String name = item.name;
            if (name != null && name.length() > 5) {
                name = name.substring(0, 5);
            }
            views.setTextViewText(R.id.tv_name, name);
        } else {
            views.setTextViewText(R.id.tv_month_label, "제철음식");
            views.setTextViewText(R.id.tv_emoji, "🌿");
            views.setTextViewText(R.id.tv_name, "앱을 열어보세요");
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
