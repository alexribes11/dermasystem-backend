import glob
import os
pathToProcessedFile = './outputImages/inpainted/artificial_hair/' + 'ip_Private_Individual_Garden_Plot'
paths = glob.glob(pathToProcessedFile + ".*")
pathToFileWithExt = paths[0]
print(os.path.isfile(pathToProcessedFile))
print(os.path.isfile(pathToProcessedFile + ".*"))
pathToFile, ext = os.path.splitext(pathToFileWithExt)
print(pathToFile)
print(ext)