<script lang="ts" setup>
import { type CalendarRangeType, UITypes, ViewTypes, isSystemColumn } from 'nocodb-sdk'
import type { SelectProps } from 'ant-design-vue'

const meta = inject(MetaInj, ref())

const { $api } = useNuxtApp()

const activeView = inject(ActiveViewInj, ref())

const isLocked = inject(IsLockedInj, ref(false))

const IsPublic = inject(IsPublicInj, ref(false))

const { loadViewColumns } = useViewColumnsOrThrow()

const { loadCalendarMeta, loadCalendarData, loadSidebarData, fetchActiveDates } = useCalendarViewStoreOrThrow()

const calendarRangeDropdown = ref(false)

watch(
  () => activeView.value?.id,
  async (newVal, oldVal) => {
    if (newVal !== oldVal && meta.value) {
      await loadViewColumns()
    }
  },
  { immediate: true },
)

const calendarRange = computed<CalendarRangeType[]>(() => {
  const tempCalendarRange: CalendarRangeType[] = []

  if (!activeView.value || !activeView.value.view) return tempCalendarRange
  activeView.value.view.calendar_range?.forEach((range) => {
    tempCalendarRange.push({
      fk_from_column_id: range.fk_from_column_id,
      fk_to_column_id: range.fk_to_column_id,
    })
  })
  return tempCalendarRange
})

// We keep the calendar range here and update it when the user selects a new range
const _calendar_ranges = ref<CalendarRangeType[]>(calendarRange.value)

const saveCalendarRanges = async () => {
  if (activeView.value) {
    try {
      const calRanges = _calendar_ranges.value
        .filter((range) => range.fk_from_column_id)
        .map((range) => ({
          fk_from_column_id: range.fk_from_column_id,
          fk_to_column_id: range.fk_to_column_id,
        }))
      await $api.dbView.calendarUpdate(activeView.value?.id as string, {
        calendar_range: calRanges as CalendarRangeType[],
      })
      await loadCalendarMeta()
      await Promise.all([loadCalendarData(), loadSidebarData(), fetchActiveDates()])
    } catch (e) {
      console.log(e)
      message.error('There was an error while updating view!')
    }
  } else {
    message.error('Please select a view first')
  }
}

const dateFieldOptions = computed<SelectProps['options']>(() => {
  return (
    meta.value?.columns
      ?.filter((c) => c.uidt === UITypes.Date || (c.uidt === UITypes.DateTime && !isSystemColumn(c)))
      .map((c) => ({
        label: c.title,
        value: c.id,
        uidt: c.uidt,
      })) ?? []
  )
})
const addCalendarRange = async () => {
  _calendar_ranges.value.push({
    fk_from_column_id: dateFieldOptions.value![0].value as string,
    fk_to_column_id: null,
  })
  await saveCalendarRanges()
}
/*
const removeRange = async (id: number) => {
  _calendar_ranges.value = _calendar_ranges.value.filter((_, i) => i !== id)
  await saveCalendarRanges()
}

const saveCalendarRange = async (range: CalendarRangeType, value?) => {
  range.fk_to_column_id = value
  await saveCalendarRanges()
} */
</script>

<template>
  <NcDropdown v-if="!IsPublic" v-model:visible="calendarRangeDropdown" :trigger="['click']" class="!xs:hidden">
    <div class="nc-calendar-btn">
      <NcButton
        v-e="['c:calendar:change-calendar-range']"
        :disabled="isLocked"
        class="nc-toolbar-btn !border-0 group !h-6"
        size="small"
        type="secondary"
        data-testid="nc-calendar-range-btn"
      >
        <div class="flex items-center gap-2">
          <component :is="iconMap.calendar" class="h-4 w-4 transition-all group-hover:text-brand-500" />
          <span class="text-capitalize !group-hover:text-brand-500 !text-[13px] font-medium">
            {{ $t('activity.settings') }}
          </span>
        </div>
      </NcButton>
    </div>
    <template #overlay>
      <div v-if="calendarRangeDropdown" class="w-98 space-y-6 rounded-2xl p-6" data-testid="nc-calendar-range-menu" @click.stop>
        <div>
          <div class="flex mb-3 justify-between">
            <div class="flex items-center gap-3">
              <GeneralViewIcon
                :meta="{
                  type: ViewTypes.CALENDAR,
                }"
                class="w-6 h-6"
              />
              <span class="font-bold text-base"> {{ `${$t('activity.calendar')} ${$t('activity.viewSettings')}` }}</span>
            </div>

            <a
              class="text-sm !text-gray-600 !font-default !hover:text-gray-600"
              href="`https://docs.nocodb.com/views/view-types/calendar`"
              target="_blank"
            >
              Go to Docs
            </a>
          </div>
          <NcDivider divider-class="!border-gray-200" />
        </div>

        <div
          v-for="(range, id) in _calendar_ranges"
          :key="id"
          class="flex w-full gap-2 mb-2 items-center"
          data-testid="nc-calendar-range-option"
        >
          <span>
            {{ $t('labels.organiseBy') }}
          </span>
          <NcSelect
            v-model:value="range.fk_from_column_id"
            :placeholder="$t('placeholder.notSelected')"
            data-testid="nc-calendar-range-from-field-select"
            @change="saveCalendarRanges"
          >
            <a-select-option
              v-for="(option, opId) in [...(dateFieldOptions ?? [])].filter((r) => {
                if (id === 0) return true
                const firstRange = (dateFieldOptions ?? []).find((f) => f.value === calendarRange[0].fk_from_column_id)
                return firstRange?.uidt === r.uidt
              })"
              :key="opId"
              class="w-40"
              :value="option.value"
            >
              <div class="flex w-full gap-2 justify-between items-center">
                <div class="flex items-center">
                  <SmartsheetHeaderIcon :column="option" />
                  <NcTooltip class="truncate flex-1 max-w-18" placement="top" show-on-truncate-only>
                    <template #title>{{ option.label }}</template>
                    {{ option.label }}
                  </NcTooltip>
                </div>

                <component
                  :is="iconMap.check"
                  v-if="option.value === range.fk_from_column_id"
                  id="nc-selected-item-icon"
                  class="text-primary min-w-4 h-4"
                />
              </div>
            </a-select-option>
          </NcSelect>

          <!--          <div
            v-if="range.fk_to_column_id === null && isEeUI"
            class="flex cursor-pointer flex text-gray-800 items-center gap-1"
            data-testid="nc-calendar-range-add-end-date"
            @click="saveCalendarRange(range, undefined)"
          >
            <component :is="iconMap.plus" class="h-4 w-4" />
            {{ $t('activity.addEndDate') }}
          </div>
          <template v-else-if="isEeUI">
            <span>
              {{ $t('activity.withEndDate') }}
            </span>
            <div class="flex">
              <NcSelect
                v-model:value="range.fk_to_column_id"
                :disabled="!range.fk_from_column_id"
                :placeholder="$t('placeholder.notSelected')"
                class="!rounded-r-none nc-to-select"
                data-testid="nc-calendar-range-to-field-select"
                @change="saveCalendarRanges"
              >
                <a-select-option
                  v-for="(option, opId) in [...dateFieldOptions].filter((f) => {
                    const firstRange = dateFieldOptions.find((f) => f.value === calendarRange[0].fk_from_column_id)
                    return firstRange?.uidt === f.uidt
                  })"
                  :key="opId"
                  :value="option.value"
                >
                  <div class="flex items-center">
                    <SmartsheetHeaderIcon :column="option" />
                    <NcTooltip class="truncate flex-1 max-w-18" placement="top" show-on-truncate-only>
                      <template #title>{{ option.label }}</template>
                      {{ option.label }}
                    </NcTooltip>
                  </div>
                </a-select-option>
              </NcSelect>
              <NcButton class="!rounded-l-none !border-l-0" size="small" type="secondary" @click="saveCalendarRange(range, null)">
                <component :is="iconMap.delete" class="h-4 w-4" />
              </NcButton>
            </div>
          </template>

          <NcButton v-if="id !== 0" size="small" type="secondary" @click="removeRange(id)">
            <component :is="iconMap.close" />
          </NcButton>
            -->
        </div>

        <!--
        <div class="text-[13px] text-gray-500 py-2">Records in this view will be based on the specified date field.</div>
-->

        <NcButton
          v-if="_calendar_ranges.length === 0"
          class="mt-2"
          data-testid="nc-calendar-range-add-btn"
          size="small"
          type="secondary"
          @click="addCalendarRange"
        >
          <component :is="iconMap.plus" />
          Add date field
        </NcButton>
      </div>
    </template>
  </NcDropdown>
</template>

<style lang="scss" scoped>
.nc-to-select .ant-select-selector {
  @apply !rounded-r-none;
}
</style>
