package com.neurocal.neurocal

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.SharedPreferences
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import es.antonborri.home_widget.HomeWidgetProvider

// Today's Focus Score, the Up next step and the streak on the home screen. The app writes the values
// (lib/home_widget/focus_widget.dart) each time Today loads; tapping the widget opens the app.
class FocusWidget : HomeWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
        widgetData: SharedPreferences,
    ) {
        for (id in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.focus_widget).apply {
                setTextViewText(R.id.focus_widget_score, widgetData.getString("score", null) ?: "–")
                setTextViewText(R.id.focus_widget_word, widgetData.getString("word", null) ?: "Focus Score")
                setTextViewText(R.id.focus_widget_next, widgetData.getString("next", null) ?: "Open NeuroCal to start your day")
                setTextViewText(R.id.focus_widget_streak, widgetData.getString("streak", null) ?: "")
                setOnClickPendingIntent(R.id.focus_widget_root, HomeWidgetLaunchIntent.getActivity(context, MainActivity::class.java))
            }
            appWidgetManager.updateAppWidget(id, views)
        }
    }
}
