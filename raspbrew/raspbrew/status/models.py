from django.db import models
from raspbrew import settings
#from raspbrew.common.models import Probe, SSR, PID
from raspbrew.globalsettings.models import GlobalSettings
from copy import deepcopy
from django.core.serializers.json import DjangoJSONEncoder 
import os, time, json, time
from datetime import datetime
from django.utils import timezone
from django.db.models.signals import pre_delete
from django.dispatch import receiver

def unix_time(dt):
	dt=dt.replace(tzinfo=None)
	epoch = datetime.fromtimestamp(0)
	delta = dt - epoch
	return delta.total_seconds()

def unix_time_millis(dt):
	return unix_time(dt) * 1000.0
	
#this class stores the current status
class ProbeStatus(models.Model):
	owner = models.ForeignKey('auth.User', related_name='probestatuses')
	one_wire_Id = models.CharField(null=True, blank=True, max_length=30)
	name = models.CharField(max_length=30)
	type = models.IntegerField(default=0)
	
	#the probe's current temperature. Returns c or f depending on the global units
	temperature = models.DecimalField(null=True, blank=True, decimal_places=3, max_digits=6)  
	
	#the probe's current target temperature. Returns c or f depending on the global units
	target_temperature = models.DecimalField(null=True, blank=True, decimal_places=3, max_digits=6)  
	
	#a correction factor to apply (if any)
	correction_factor = models.DecimalField(default=0.0, decimal_places=3, max_digits=6) 
	
	#the original Probe
	probe = models.ForeignKey('common.Probe', null=True)

	@classmethod
	def cloneFrom(cls, probe):
		p=cls()
		p.probe = probe
		p.owner = probe.owner
		p.one_wire_Id = probe.one_wire_Id
		p.name = probe.name
		p.type = probe.type
		p.temperature = probe.temperature
		p.target_temperature = probe.target_temperature
		p.correction_factor = probe.correction_factor

		p.save()
		
		for ssr in probe.ssrs.all():
			#update the ssrs
			newssr = SSRStatus.cloneFrom(ssr)
			p.ssrstatus_set.add(newssr)
		
		p.save()
		return p

class PIDStatus(models.Model):
	cycle_time = models.FloatField(default=2.0)
	k_param = models.FloatField(default=70.0)
	i_param = models.FloatField(default=80.0)
	d_param = models.FloatField(default=4.0)
	power = models.IntegerField(default=100)
	enabled = models.BooleanField(default=True) #enabled
	
	#the original pid
	pid = models.ForeignKey('common.PID', null=True)
	
	@classmethod
	def cloneFrom(cls,_pid):
		pid = cls()
		pid.pid = _pid
		pid.cycle_time = _pid.cycle_time
		pid.k_param = _pid.k_param
		pid.i_param = _pid.i_param
		pid.d_param = _pid.d_param
		pid.power = _pid.power
		pid.enabled = _pid.enabled
		
		pid.save()
		return pid
		
class SSRStatus(models.Model):
	owner = models.ForeignKey('auth.User', related_name='ssrstatuses')
	#an ssr is directly tied to a probe and a pid
	name = models.CharField(max_length=30)
	pin = models.IntegerField()
	enabled = models.BooleanField(default=True) #enabled
	state = models.BooleanField(default=False) #on/off
	heater_or_chiller = models.IntegerField(default=0)
	
	probe = models.ForeignKey(ProbeStatus, null=True)
	pid = models.OneToOneField(PIDStatus, null=True)
	
	#the original ssr
	ssr = models.ForeignKey('common.SSR', null=True)

	@classmethod
	def cloneFrom(cls,_ssr):
		ssr = cls()#deepcopy(_ssr)
		ssr.ssr = _ssr
		ssr.name = _ssr.name
		ssr.pin = _ssr.pin
		ssr.enabled = _ssr.enabled
		ssr.state = _ssr.state
		ssr.owner = _ssr.owner
		ssr.heater_or_chiller = _ssr.heater_or_chiller
		
		if _ssr.pid:
			ssr.pid = PIDStatus.cloneFrom(_ssr.pid)
		ssr.save()
		
		return ssr

				
class Status(models.Model):
	owner = models.ForeignKey('auth.User', related_name='statuses')

	#status can be for a FermConfiguration
	fermconfig = models.ForeignKey('ferm.FermConfiguration',null=True, blank=True)
	#or a BrewConfiguration
	brewconfig = models.ForeignKey('brew.BrewConfiguration',null=True, blank=True)
	
	#and contains copies of probes
	probes = models.ManyToManyField(ProbeStatus,null=True, blank=True)
	
	date = models.DateTimeField(default=timezone.now()) #time of this status
	
	status = models.CharField(max_length=10000,null=True, blank=True)


#pre_delete receivers

@receiver(pre_delete, sender=Status)
def status_pre_delete(sender, instance, **kwargs):
	#delete any
	for probe in instance.probes.all():
		for ssrstatus in probe.ssrstatus_set.all():
			ssrstatus.pid.delete()

	instance.probes.all().delete()

#@receiver(pre_delete, sender=SSRStatus)
#def ssrstatus_pre_delete(sender, instance, **kwargs):
#	instance.pid.delete()
