from rest_framework import serializers
from django.contrib.auth.models import User

from .models import Probe, SSR, PID, Schedule, ScheduleStep, ScheduleTime
from kriek.status.models import ProbeStatus, Status
from kriek.brew.models import BrewConfiguration
from kriek.ferm.models import FermConfiguration


class UnixEpochDateField(serializers.DateTimeField):
	def to_native(self, value):
		""" Return epoch time for a datetime object or ``None``"""
		import time
		try:
			return int(time.mktime(value.timetuple())*1000)
		except (AttributeError, TypeError):
			return None

	def from_native(self, value):
		import datetime
		return datetime.datetime.fromtimestamp(int(value))


class UserSerializer(serializers.ModelSerializer):
	class Meta:
		model = User
		fields = ('url', 'username', 'email', 'groups')


class PIDSerializer(serializers.ModelSerializer):
	class Meta:
		model = PID
		fields = ('cycle_time', 'k_param', 'i_param', 'd_param', 'power', 'enabled')


class SSRSerializer(serializers.ModelSerializer):
	pid = PIDSerializer(many=False)

	class Meta:
		model = SSR
		fields = ('id', 'name', 'pin', 'probe', 'pid', 'enabled', 'state', 'heater_or_chiller', 'owner', 'eta', 'degrees_per_minute')


class ScheduleStepSerializer(serializers.ModelSerializer):
	class Meta:
		model = ScheduleStep


class ScheduleTimeSerializer(serializers.ModelSerializer):
	class Meta:
		model = ScheduleTime


class ScheduleSerializer(serializers.ModelSerializer):
	scheduleTimes = ScheduleTimeSerializer(many=True)
	scheduleSteps = ScheduleStepSerializer(many=True)

	class Meta:
		model = Schedule


class ProbeSerializer(serializers.ModelSerializer):
	last_temp_date  = UnixEpochDateField(source='last_temp_date')
	ssrs = SSRSerializer(many=True)
	schedules = ScheduleSerializer(many=True)

	class Meta:
		model = Probe
		fields = ('id', 'name', 'one_wire_id', 'type', 'temperature', 'target_temperature', 'owner', 'ssrs', 'schedules')


class BrewConfSerializer(serializers.ModelSerializer):
	ssrs = SSRSerializer(many=True)
	probes = ProbeSerializer(many=True)

	class Meta:
		model = BrewConfiguration
		fields = ('id', 'name', 'probes', 'ssrs', 'enabled', 'allow_multiple_ssrs', 'schedule')


class FermConfSerializer(serializers.ModelSerializer):
	ssrs = SSRSerializer(many=True)
	probes = ProbeSerializer(many=True)

	# def restore_object(self, attrs, instance=None):
	# 	if instance:
	#

	class Meta:
		model = FermConfiguration
		fields = ('id', 'name', 'probes', 'enabled', 'schedule')

#update the probe here because.. python
SSRSerializer.probe = ProbeSerializer(many=False)


## status
class ProbeStatusSerializer(serializers.ModelSerializer):
	#probe = ProbeSerializer(many=False)

	class Meta:
		model = ProbeStatus
		fields = ('id', 'name', 'one_wire_id', 'type', 'temperature', 'target_temperature', 'probe', 'owner')


class StatusSerializer(serializers.ModelSerializer):
	probes = ProbeStatusSerializer(many=True)

	class Meta:
		model = Status
		fields = ('id', 'fermconfig', 'brewconfig', 'probes', 'date', 'owner')

