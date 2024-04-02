print("Hello from python script one call")

import inspect
import numpy as np

#print(np.version)
#print(np.__version__)

#print("numpy path=", inspect.getfile(np))

import sys
import cv2
from pathlib import Path
import matplotlib.pyplot as plt
import os
#PATH_TO_INPUT_IMAGE = "./inputImages/Scalp1_DenseHairs.jpg"
#PATH_TO_INPUT_IMAGE = "./inputImages/DA_Melanoma_9883.jpg"
PATH_TO_INPUT_IMAGE = sys.argv[1]
NAME_OF_INPUT_IMAGE = Path(PATH_TO_INPUT_IMAGE).stem
print(NAME_OF_INPUT_IMAGE)
print(os.getcwd())

src = cv2.imread(PATH_TO_INPUT_IMAGE)

PATH_TO_OUTPUT_IMAGE_FOLDER = "./outputImages/"
NAME_OF_TYPE_OF_IMAGE = "artificial_hair"

def save_im_to_path(path_to_save_image, im):
    #
    path_to_save_image_with_number = path_to_save_image
    grayscale_image_already_exists = os.path.exists(path_to_save_image_with_number + '.jpg')
    if grayscale_image_already_exists:
        i = 2
        MAX_ITER = 100
        while (grayscale_image_already_exists) and (i < MAX_ITER):
            path_to_save_image_with_number = path_to_save_image + '_' + str(i)
            grayscale_image_already_exists = os.path.isfile(path_to_save_image_with_number + '.jpg')
            i += 1
    
    path_to_save_image_with_number = path_to_save_image_with_number + '.jpg'
    was_able_to_save = cv2.imwrite(path_to_save_image_with_number, im, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    print("was_able_to_save=", was_able_to_save, " for ", path_to_save_image_with_number)


print( src.shape )
#cv2.imshow("original Image" , src )


# Convert the original image to grayscale
grayScale = cv2.cvtColor( src, cv2.COLOR_RGB2GRAY )
#cv2.imshow("GrayScale",grayScale)

PATH_TO_GRAYSCALE_IMAGE = PATH_TO_OUTPUT_IMAGE_FOLDER + 'grayScale/' + NAME_OF_TYPE_OF_IMAGE + '/gS_' + NAME_OF_INPUT_IMAGE
save_im_to_path(PATH_TO_GRAYSCALE_IMAGE, grayScale)

# Kernel for the morphological filtering
kernel = cv2.getStructuringElement(1,(17,17))
print("type(kernel)=", type(kernel))
print(kernel)

# Perform the blackHat filtering on the grayscale image to find the 
# hair countours
blackhat = cv2.morphologyEx(grayScale, cv2.MORPH_BLACKHAT, kernel)
#cv2.imshow("BlackHat",blackhat)
#cv2.imwrite(PATH_TO_OUTPUT_IMAGE_FOLDER + 'blackhat/' + NAME_OF_TYPE_OF_IMAGE + '/bh_' + NAME_OF_INPUT_IMAGE + '.jpg', blackhat, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
save_im_to_path(PATH_TO_OUTPUT_IMAGE_FOLDER + 'blackhat/' + NAME_OF_TYPE_OF_IMAGE + '/bh_' + NAME_OF_INPUT_IMAGE, blackhat)

# intensify the hair countours in preparation for the inpainting 
# algorithm
lower_bound = 10
#lower_bound = 80
upper_bound = 255
ret,thresh2 = cv2.threshold(blackhat,lower_bound,upper_bound,cv2.THRESH_BINARY)
print( thresh2.shape )
#cv2.imshow("Thresholded Mask",thresh2)
#cv2.imwrite(PATH_TO_OUTPUT_IMAGE_FOLDER + 'thresholded/' + NAME_OF_TYPE_OF_IMAGE + '/th_' + NAME_OF_INPUT_IMAGE + '.jpg', thresh2, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
save_im_to_path(PATH_TO_OUTPUT_IMAGE_FOLDER + 'thresholded/' + NAME_OF_TYPE_OF_IMAGE + '/th_' + NAME_OF_INPUT_IMAGE, thresh2)


# inpaint the original image depending on the mask
dst = cv2.inpaint(src,thresh2,1,cv2.INPAINT_TELEA)
#cv2.imshow("InPaint",dst)
#cv2.imwrite(PATH_TO_OUTPUT_IMAGE_FOLDER + 'inpainted/' + NAME_OF_TYPE_OF_IMAGE + '/ip_' + NAME_OF_INPUT_IMAGE + '.jpg', dst, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
print('path_to_save_image=', PATH_TO_OUTPUT_IMAGE_FOLDER + 'inpainted/' + NAME_OF_TYPE_OF_IMAGE + '/ip_' + NAME_OF_INPUT_IMAGE)
save_im_to_path(PATH_TO_OUTPUT_IMAGE_FOLDER + 'inpainted/' + NAME_OF_TYPE_OF_IMAGE + '/ip_' + NAME_OF_INPUT_IMAGE, dst)
